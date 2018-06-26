'use strict'

const d3 = require('d3')
const mist3 = require('node-mist3')
const $ = require('jquery/dist/jquery.slim')
const crypto = require('crypto')

const HomologGroupTag = require('./HomologGroupTag')
const HomologGroupEntry = require('./HomologGroupEntry')
const ListOfHomologGroups = require('./ListOfHomologGroups')


let mouseover = true
let selected = false
let colorValue = '006EBD'
let currentEvalue = 100
const colorOfGroupZero = '#ffffff'
const tagGroupZero = new HomologGroupTag(colorOfGroupZero)
const entryGroupZero = new HomologGroupEntry(tagGroupZero)
let currentGroupTag = tagGroupZero
let ultimatelyMostRight = 0
let ultimatelyMostLeft = 10^6

const geneNameFontSize = 12
const geneNameInclination = -45

const maxLogEvalue = 200

const arrow2line = d3.line()
	.x(function(d) {
		return d.x
	})
	.y(function(d) {
		return d.y
	})

function makePathOfOneGene_(startX, len, index, strand, H, arrowBorderWidth) {
	let arrow = []
	const h = H/5
	if (strand !== '-') {
		arrow = [
			{x: startX, y: index},
			{x: startX + len * 8/11, y: index},
			{x: startX + len * 8/11, y: index - h},
			{x: startX + len, y: index + h*1.5},
			{x: startX + len * 8/11, y: index + h * 4},
			{x: startX + len * 8/11, y: index + h * 3},
			{x: startX, y: index + h * 3},
			{x: startX, y: index - arrowBorderWidth/2}
		]
	}
	else {
		arrow = [
			{x: startX, y: index + h * 1.5},
			{x: startX + len * 3/11, y: index - h},
			{x: startX + len * 3/11, y: index},
			{x: startX + len, y: index},
			{x: startX + len, y: index + h * 3},
			{x: startX + len * 3/11, y: index + h * 3},
			{x: startX + len * 3/11, y: index + h * 4},
			{x: startX, y: index + h * 1.5}
		]
	}
	return arrow
}

function drawGeneCluster(svg, op, i, maxLenGeneCluster, width) {
	const padding = 5
	const paddingBetweenArrows = 30

	const H = 25
	const arrowBorderWidth = 1
	const refArrowBorderWidth = 3

	const splitScreen = 2
	const boxSize = svg.node().getBoundingClientRect()
	const GNboxRight = boxSize.width - padding
	const GNboxLeft = boxSize.width - width

	const refStart = op.gn[0].start
	const xDomRange = (op.refStrand === '+') ? [GNboxLeft, GNboxRight] : [GNboxRight, GNboxLeft]

	const xDom = d3
		.scaleLinear()
		.domain([0, maxLenGeneCluster])
		.range(xDomRange)

	for (let j = 0, N = op.gn.length; j < N; j++) {
		const groupList = new ListOfHomologGroups()
		op.gn[j].groups = groupList
		op.gn[j].groups.addGroup(entryGroupZero)
	}

	const gs = svg.append('g')
		.attr('class', 'geneCluster')
		.attr('id', `GN${i}`)
		.selectAll('.geneCluster')
		.data(op.gn)

	gs.enter()
		.append('path')
		.attr('class', 'arrow')
		.attr('d', function(gene) {
			gene.y = (padding + H / 2) + i * (H + paddingBetweenArrows)
			return makeArrows(gene, H, refStart, xDom, arrowBorderWidth)
		})
		.attr('stroke', (gene) => {
			if (gene.aseq_id)
				return 'black'
			return 'lightgrey'
		})
		.attr('stroke-width', function(gene) {
			return (gene.stable_id === op.ref) ? refArrowBorderWidth : arrowBorderWidth
		})
		.attr('fill', (gene) => {
			return gene.groups.getLastGroupColor()
		})
		.on('click', (gene) => {
			toggleGeneSelection_(svg, gene)
		})
		.on('mouseover', (gene) => {
			displayGeneInfo_(gene, '#divTip')
		})

	gs.enter()
		.append('text')
		.attr('class', 'arrowText')
		.attr('font-size', geneNameFontSize)
		.text((gene) => {
			let names = ''
			if (gene.names)
				names = gene.names.join(', ')
			return names
		})
		.attr('transform', function(gene) {
			const dx = this.getComputedTextLength()
			const y = gene.y + geneNameFontSize / 2 + H + dx/2 * Math.cos(geneNameInclination) + geneNameFontSize / 2
			const x = xDom(gene.start - refStart) + (xDom(gene.stop) - xDom(gene.start)) / 2 - dx / 2
			gene.textPos = {
				x,
				y
			}
			return `translate(${x} ${y}) rotate(${geneNameInclination}) `
		})

	d3.select('#evalueCutOff')
		.on('input', function() {
			if (selected && currentEvalue > this.value) {
				svg.selectAll('.arrow')
				.filter((gene) => {
					return gene.groups.getLastGroupTag() === currentGroupTag
				})
				.each((gene) => {
					gene.groups.popGroup()
				})
			}
			currentEvalue = this.value
			markHomologs(null, svg, currentEvalue)
			unMarkHomologs(svg, currentEvalue)
		})
}

function makeArrows(gene, H, refStart, xDom, arrowBorderWidth) {
	return arrow2line(
		makePathOfOneGene_(
			xDom(gene.start - refStart),
			xDom(gene.stop) - xDom(gene.start),
			gene.y,
			gene.strand,
			H,
			arrowBorderWidth
		)
	)
}

function changeSelectionColor(svg, color) {
	colorValue = color
	if (selected) {
		const selectedHash = selected.groups.getLastGroupHash()
		svg.selectAll('.arrow')
			.filter((gene) => {
				return gene.groups.getLastGroupHash() === selectedHash
			})
			.style('fill', color)
			.each((gene) => {
				gene.groups.updateColorOfLastGroup(color)
			})
	}
}

function markHomologs(queryGene, svg, value) {
	if (selected) {
		const selGene = queryGene || selected
		const blastHits = {}

		for (let j = 0, N = selGene.blast.length; j < N; j++) {
			const evalue = selGene.blast[j].hsps[0].evalue
			const geneStableId = selGene.blast[j].def.split('|')[1]
			const logEvalue = (evalue === 0) ? maxLogEvalue : -Math.log10(evalue)
			if (logEvalue > value)
				blastHits[geneStableId] = logEvalue
		}
		svg.selectAll('.arrow')
			.filter((gene) => {
				if (blastHits.hasOwnProperty(gene.stable_id))
					console.log('we have it')
				if (gene.groups.getLastGroupTag() === currentGroupTag)
					console.log('but it is already in the group')
				return (gene.groups.getLastGroupTag() !== currentGroupTag && blastHits.hasOwnProperty(gene.stable_id))
			})
			.style('fill', (gene) => {
				let logEvalue = maxLogEvalue
				if (!selGene.groups.getLastGroupLogEvalue())
					logEvalue = blastHits[gene.stable_id]
				else if (blastHits[gene.stable_id] > selGene.groups.getLastGroupLogEvalue())
					logEvalue = selGene.groups.getLastGroupLogEvalue()
				else
					logEvalue = blastHits[gene.stable_id]
				const newGroupEntry = new HomologGroupEntry(currentGroupTag, logEvalue)
				newGroupEntry.parent = selGene.stable_id
				gene.groups.addGroup(newGroupEntry)
				console.log(`turning on: ${gene.stable_id}`)
				return gene.groups.getLastGroupColor()
			})
			.each((gene) => {
				markHomologs(gene, svg, value)
			})
		displayGeneInfo_(selected, '#divTip')
	}
}

function unMarkHomologs(svg, value) {
	if (selected) {
		svg.selectAll('.arrow')
			.filter((gene) => {
				return gene.groups.getLastGroupHash() === currentGroupTag.getHash()
			})
			.filter((gene) => {
				return gene.groups.getLastGroupLogEvalue() < value
			})
			.each((gene) => {
				gene.groups.popGroup()
			})
			.style('fill', (gene) => {
				console.log(`turning on: ${gene.stable_id}`)
				return gene.groups.getLastGroupColor()
			})
	}
}

function toggleGeneSelection_(svg, gene) {
	console.log('before')
	console.log(gene)
	if (mouseover) {
		selected = gene
		console.log(gene.groups.getLastGroupHash())
		console.log(tagGroupZero.getHash())
		if (gene.groups.getLastGroupHash() === tagGroupZero.getHash()) {
			console.log('making new group')
			const newGroup = new HomologGroupTag(colorValue)
			console.log(newGroup)
			currentGroupTag = newGroup
			const newGroupEntry = new HomologGroupEntry(newGroup)
			selected.groups.addGroup(newGroupEntry)
		}
		else {
			currentGroupTag = gene.groups.getLastGroupTag()
		}
		svg.selectAll('.arrow')
			.filter((arrow) => {
				return arrow.stable_id === gene.stable_id
			})
			.style('stroke', 'red')
			.style('fill', () => {
				console.log(selected.groups.getLastGroupColor())
				return selected.groups.getLastGroupColor()
			})
		svg.selectAll('.arrow')
			.filter((arrow) => {
				return arrow.stable_id !== gene.stable_id
			})
			.on('click', () => {
				return false
			})
		svg.selectAll('.arrow').on('mouseover', (g) => {
			d3.select('#compTip').style('display', 'table-cell')
			displayGeneInfo_(g, '#compTip')
		})
		mouseover = false
		markHomologs(gene, svg, currentEvalue)
		displayGeneInfo_(gene, '#divTip')
	}
	else {
		selected = false
		svg.selectAll('.arrow')
			.filter((arrow) => {
				return arrow.stable_id === gene.stable_id
			})
			.style('stroke', 'black')
		svg.selectAll('.arrow')
			.filter((arrow) => {
				return arrow.stable_id !== gene.stable_id
			})
			.on('click', (arrow) => {
				toggleGeneSelection_(svg, arrow)
			})
		svg.selectAll('.arrow').on('mouseover', (gene) => {
			d3.select('#compTip').style('display', 'none')
			displayGeneInfo_(gene, '#divTip')
		})
		mouseover = true
		currentGroupTag = tagGroupZero
	}
	console.log('after')
	console.log(gene)
}

function displayGeneInfo_(gene, tipId) {
	const divtip = d3.select(tipId)
	let httpsDefaultOptions = {
		method: 'GET',
		hostname: 'api.mistdb.caltech.edu',
		headers: {},
		agent: false
	}
	const genomes = new mist3.Genomes(httpsDefaultOptions, 'error')
	let organismName = ''
	// const DA = `<img src="https://api.mistdb.caltech.edu/v1/aseqs/${gene.aseq_id}.png">`
	genomes.getGenomeInfoByVersion(gene.stable_id.split('-')[0]).then((info) => {
		organismName = info.name
		divtip.transition()
		const names = gene.names ? gene.names.join(',') : ''
		divtip.html(`<h>Organism: ${organismName}<br/>Stable ID: ${gene.stable_id}<br/>locus: ${gene.locus}<br/>Old locus: ${gene.old_locus}<br/>Description: ${gene.product}</h>`)
	})
}

function alignClusters(svg, gns, x0, widthGN) {
	let mostLeft = 10^6 //a large number
	gns.forEach((gn) => {
		const box = svg.selectAll('.arrow')
		.filter((gene) => {
			return gene.stable_id === gn.ref
		})
		.node()
		.getBBox()

		if (box.x < mostLeft)
			mostLeft = box.x
	})

	gns.forEach((gn, i) => {
		const box = svg.selectAll('.arrow')
		.filter((gene) => {
			return gene.stable_id === gn.ref
		})
		.node()
		.getBBox()

		const dx = -1 * (box.x - mostLeft - x0 - widthGN/2)
		svg.select(`#GN${i}`).selectAll('.arrow')
			.attr('transform', `translate(${dx}, 0)`)
		svg.select(`#GN${i}`).selectAll('.arrowText')
			.attr('transform', function(gene) {
				const y = gene.textPos.y
				const x = gene.textPos.x + dx
				return `translate(${x} ${y}) rotate(${geneNameInclination}) `
			})
	})
}

function reScaleClusters(svg, widthGN) {
	svg.selectAll('.arrow')
	.each(function(gene) {
		const thisBox = svg.selectAll('.arrow')
			.filter((gene2) => {
				return gene === gene2
			})
			.node()
			.getBBox()

		const rightBound = thisBox.x + thisBox.width
		const leftBound = thisBox.x
		if (ultimatelyMostRight < rightBound)
			ultimatelyMostRight = rightBound
		if (ultimatelyMostLeft > leftBound)
			ultimatelyMostLeft = leftBound
	})

	const reScaleFactor = widthGN / (ultimatelyMostRight - ultimatelyMostLeft)
	console.log(reScaleFactor)
	svg.selectAll('.arrow')
		.attr('transform', `scale(${reScaleFactor} 0)`)
}

module.exports = {
	drawGeneCluster,
	changeSelectionColor,
	alignClusters,
	reScaleClusters
}
