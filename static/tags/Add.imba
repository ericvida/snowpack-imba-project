###
	box-shadow: 0 0 0 1px #c63702 inset,
	0 0 0 (@btn-box-height / 4) rgba(255, 255, 255, 0.15) inset,
	0 @btn-box-height 0 0 #C24032,
	0 @btn-box-height 0 1px rgba(0, 0, 0, 0.4),
	0 @btn-box-height @btn-box-height 1px rgba(0, 0, 0, 0.5);
###
export tag Add
	def render
		<self>
			<button> <span> <slot> "click me"
	css button
		1depth: 3px @hover: 4px @active: 0px
		--text: pink2 @hover: pink1
		--color: pink7 @hover: pink6 @active: pink6
		--shade: pink9 @hover: pink8 @active: pink9
		bg: var(--color)
		transition: all .20s
		transform: translateY(-2depth)
		radius: 50px
		h: 100px min-width: 100px
		my: 2em
		bs:0 0 0 1px pink7 inset, 0 0 0 .25depth pink5/15 inset, 0 2depth 0 0 pink8, 0 2depth 0 1px pink5/40, 0 2depth 2depth 1px pink5/30
		bs@active: 0 0 0 1px pink7 inset, 0 0 0 .25depth pink7/15 inset, 0 0 0 1px pink7/40
		& span 
			fs:5xl
			fw: bold
			color: var(--text)
