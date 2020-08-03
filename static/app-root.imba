import {Add} from './tags/Add'
import {Logo} from './tags/Logo'

let counter = 0

css @root, body
	1radius: 5px
	p:0	m:0
	box-sizing: border-box
tag app-root
	css %app
		display: flex
		fld: column  
		ai:center
		ta:center
		bg:gray9
		min-height: 100vh
	def render
		<self%app>
			<Logo>
			<Card>
tag Card
	def incr
		counter++
		if (counter % 10) is 0
			console.log "Hurray!"
		console.log "increase to {counter}"
	def reset
		counter = 0
		console.log "reset to {counter}"
	def render
		<self>
			<Add @click.incr> "{counter}"
			<span.reset  @click.reset> "reset"
	css &
		bg:white ff:sans shadow:xl
		min-width:300px py:2em px:2em br:2
		display:flex fld:column ai:justify
		& .reset
			fs:2xl
			fw:bold
			color:gray4 @hover:purple6 @active:purple8 
			cursor:pointer user-select:none

imba.mount <app-root>