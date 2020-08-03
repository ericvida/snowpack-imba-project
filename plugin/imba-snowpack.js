/*
snowpack-plugin-imba written 2020 by eulores and released under MIT license.

Parameters
==========
All parameters are read from package.json and the integrated snowpack section.

All options for the imba compiler can be overriden by the plugin options

These options are read from the snowpack section:
  installOptions.sourceMap, default is true
  buildOptions.minify, default is true

These options are read from the embedded plugin section:
  splitting, default is false
  target, default is es2017
  minify, default is true

Mount source directories containing imba sources and other assets to destination paths (public, src).
Assets are copied as is, imba sources are compiled to javascript and bundled ("/", "/static").
Define one or several main imba source entry points (only script name, path and extension are ignored) in the plugin options:

package.json
{
  "scripts": {
    "start": "snowpack dev",
    "build": "snowpack build",
    "web": "http-server build -o --cors -c-1"
  },
  "snowpack": {
    "mount": {
      "static": "/static",
      "public": "/"
    },
    "plugins": [
      [
        "./plugin/imba-snowpack",
        {
          "entrypoints": ["app-root"]
        }
      ]
    ]
  }
}


Open points:

- Choose bundle name and location (config?)
- hmr does dumb page reloading, should instead reinstantiate only affected imba modules
- consolidate npm modules to lower amount of dependencies
- use cheerio to find entrypoints within HTML files
- use native log functionality and colorize output accordingly
*/

const fs = require('fs');
const fse = require('fs-extra');
const {fdir} = require('fdir');
const tmp = require('tmp');
const path = require('upath'); // compatible with Windows idiosyncrasies
const sm = require('source-map')
const convert = require('convert-source-map')
const imbac = require('imba/dist/compiler.js');
const {buildSync} = require('esbuild')

let ifDef = (maybeUndef, other) => (maybeUndef===undefined)?other:maybeUndef;

function unlinkRmParent(filename) {
  try {
    fs.unlinkSync(filename);
  } catch {};
  do {
    filename = path.dirname(filename);
    if (fs.readdirSync(filename).length) return;
    fs.rmdirSync(filename);
  } while(true);
}

async function prependCode(srcCode, prefix, srcMap={}) {
  try {
    // console.log("srcMap", srcMap);
    dstFile = srcMap.file;
    const sourceMap = await new sm.SourceMapConsumer(srcMap);
    const node = sm.SourceNode.fromStringWithSourceMap(srcCode, sourceMap);
    sourceMap.destroy();
    node.prepend(prefix);
    let {code: dstCode, map: dstMap} = node.toStringWithSourceMap({ file: dstFile });
    dstCode = convert.removeComments(dstCode);
    dstCode = convert.removeMapFileComments(dstCode);
    dstCode = dstCode + "\n" + convert.fromObject(dstMap).toComment();
    // console.log("dstMap", convert.fromJSON(dstMap.toString()).toObject());
    return dstCode;
  } catch {
    return prefix + srcCode; // if anything fails, ignore sourceMap but continue prepending the code
  }
}

// new plugin format supported by snowpack 2.7.0 onwards
module.exports = function(snowpackConfig, pluginOptions) {
  const imbaHelper = "imba/dist/imba.js";
  let entrypoints = pluginOptions.entrypoints;
  if (typeof entrypoints === 'string') entrypoints = [entrypoints];
  if (!entrypoints) {
    console.log('Error: Missing script entrypoints!');
    console.log('Add one or multiple entrypoints to the snowpack configuration:');
    console.log('  "plugins": [ ["./plugin/imba-snowpack", {"entrypoints":["main.imba"]}] ]');
    return;
  }
  pluginOptions.entrypoints = entrypoints.map((entry) => path.changeExt(path.basename(entry), 'js'));
  return {
    name: 'snowpack-plugin-imba',
    resolve: {
      input: ['.imba', '.imba2'],
      output: ['.js'],
    },
    knownEntrypoints: [imbaHelper],

    async load({filePath, fileExt, isDev}) {
      options = {
        standalone: true,
        sourceMap: ifDef(snowpackConfig.installOptions.sourceMap, true),
        evaling: true,
        target: 'web',
        format: 'esm',
        es6: true
      };
      options.sourceRoot = '';
      Object.assign(options, pluginOptions);
      filePath = path.relative(process.cwd(), filePath);
      options.filename = path.basename(filePath);
      options.sourcePath = filePath;
      options.targetPath = options.sourcePath.replace(/\.imba\d?$/,'.js');
      const helperPath = path.join(snowpackConfig.buildOptions.webModulesUrl, imbaHelper);
      const helper = `import '${helperPath}';\n`;
      const source = fs.readFileSync(filePath, 'utf-8');
      const result = imbac.compile(source, options);
      let {js, sourcemap} = imbac.compile(source, options);
      delete sourcemap.maps; // debugging leftover?
      js = await prependCode(js, helper, sourcemap);
      return { '.js': js }
    }, // end function load

    async optimize({ buildDirectory }) {
      console.log('Started OPTIMIZE step!');
      if (snowpackConfig.devOptions.bundle) {
        const fileList = new fdir()
          .withBasePath()
          .crawl(buildDirectory)
          .sync();

        const entrypoints = fileList.filter(
          (filePath) => pluginOptions.entrypoints.some(
            (suffix) => filePath.endsWith(suffix)
          )
        );
        // console.log(entrypoints);

        // console.log('Snowpack config:', snowpackConfig);
        tmp.setGracefulCleanup();
        const {name: tmpDir, removeCallback} = tmp.dirSync({prefix: 'esbuild_', unsafeCleanup: true});
        metaFile = path.join(tmpDir, 'meta.json');
        const q = (x) => x&&(x+':')||''
        const esbuildMsg = (type, text, loc) => (loc&&(q(loc.file)+q(loc.line)+q(loc.column)+' ')||'') + `esbuild bundler ${type}: ${text}`;
        let result = false;
        try {
          let result = buildSync({
            // entryPoints: ['./build/static/app-root.js'],
            entryPoints: entrypoints,
            metafile: metaFile,
            outdir: tmpDir,
            bundle: true,
            splitting: ifDef(pluginOptions.splitting, false),
            platform: 'browser',
            format: 'esm',
            target: ifDef(pluginOptions.target, 'es2017'),
            strict: false,
            sourcemap: false,
            minify: ifDef(pluginOptions.minify, snowpackConfig.buildOptions.minify),
            color: true,
            logLevel: 'silent'
          });
        } catch(e) {
          for (const {loc, text} of e.errors||[]) console.log(esbuildMsg('error', text, loc));
          for (const {loc, text} of e.warnings||[]) console.log(esbuildMsg('warning', text, loc));
          return;
        }
        for (const {loc, text} of result.warnings||[]) console.log(esbuildMsg('warning', text, loc));
        meta = JSON.parse(fs.readFileSync(metaFile, { encoding: 'utf-8' }));
        // console.log(meta);
        let lookup = {};
        let lookupMove = {};
        for (const k of Object.keys(meta.inputs)) {
          let short = path.basename(k);
          lookup[short] = k;
        }
        for (const k of Object.keys(meta.outputs)) {
          let short = path.basename(k);
          lookupMove[k] = lookup[short] || path.join(buildDirectory, short);
        }
        for (const k of Object.keys(meta.inputs)) {
          unlinkRmParent(k);
        }
        unlinkRmParent(path.join(snowpackConfig.devOptions.out, snowpackConfig.buildOptions.webModulesUrl, 'import-map.json'));
        unlinkRmParent(path.join(snowpackConfig.devOptions.out, snowpackConfig.buildOptions.metaDir, 'env.js'));
        for (const [k, v] of Object.entries(lookupMove)) {
          fse.moveSync(k, v, {overwrite: true}); // creates dst directories if needed
        }
        removeCallback(); // cleanup and delete temp directory
        snowpackConfig.buildOptions.minify = false; // not anymore required after this step!
      }
    } // end function optimize

  }
}
