'use strict'

const d3 = require('d3')
//const drawGN = require('./drawGN')
const DrawGN = require('./DrawGN')
require('d3-selection')
const zoom = d3.zoom()

const GeneHoodObject = require('./GeneHoodObject')
const HomologLogic = require('./HomologLogic')

module.exports =
class GeneHoodViewer {
	constructor(domGNid, domErrorId) {
		this.date = Date.now()
		this.domGNid_ = domGNid
		this.domErrorId_ = domErrorId
	}

	changeColor(value) {
		const svg = d3.select(this.domGNid_).select('svg')
		this.drawGN.changeSelectionColor(value)
	}

	draw(dataString) {
		if (this.upload_(dataString)) {
			const drawSpace = d3.select(this.domGNid_)
			const dimensions = drawSpace.node().getBoundingClientRect()

			// Create div for the phylogenetic tree.
			const treeSpace = drawSpace.append('div')
				.attr('id', 'treeBox')
				.attr('class', 'phyloTree')
				.attr('width', dimensions.width * 0.25 + 'px')

			const svg = drawSpace.append('svg')
				.attr('width', dimensions.width)
				.style('border', '1px solid black')

			const geneHoodArea = svg.append('g')
				.attr('class', 'geneHoodArea')
				.attr('width', dimensions.width)
				.attr('transform', `translate (${1/3 * dimensions.width}, 20)`)

			const widthGN = 2/3 * dimensions.width

			const homologLogic = new HomologLogic(this.geneHoodObject)
			const groupInit = homologLogic.init()

			// Drawing tree and clusters
			this.drawGN = new DrawGN(this.geneHoodObject, geneHoodArea, widthGN)
			this.drawGN.init(groupInit)
			this.drawGN.drawTree(drawSpace, dimensions)
			this.drawGN.drawAllClusters()

			// Enabling synchronized scrolling for both phylogenetic tree and gene cluster 'g' elements.
			const treeAreaG = d3.select('#tnt_st_treeBox')
			const treeSVG = d3.select('.tnt_groupDiv').select('svg')
			let currTranslate = 0
			const zoomActions = () => {
				geneHoodArea.attr('transform', (d) => {
					let currentTranslate = geneHoodArea.attr('transform') ? parseInt(geneHoodArea.attr('transform').match('( | -)[0-9]{1,10}')) : 0
					currentTranslate = isNaN(currentTranslate) ? 0 : currentTranslate
					currTranslate = d3.event.sourceEvent.wheelDeltaY + currentTranslate
					return `translate(${1/3 * dimensions.width}, ${currTranslate})`
				})
				treeAreaG.attr('transform', (d) => {
					return `translate(20, ${currTranslate})`
				})
			}
			const zoomHandler = zoom.on('zoom', zoomActions)
			zoomHandler(svg)
			zoomHandler(treeSVG)

			// Setting height of viewing window to window dimensions.
			treeSVG.style('height', dimensions.height)
			svg.attr('height', dimensions.height)
		}
		else {
			console.log('Error')
		}
	}

	upload_(dataString) {
		this.hideError_()
		return this.parseData_(dataString)
	}

	parseData_(dataString) {
		let data = {}
		try {
			data = JSON.parse(dataString)
		}
		catch (err) {
			this.emitError_()
			return false
		}
		if (this.checkData_(data)) {
			this.geneHoodObject = new GeneHoodObject(data)
			console.log(`Hi! There are ${this.geneHoodObject.gns.length} neighborhoods and ${this.geneHoodObject.genes.length} genes.`)
			return true
		}
		return false
	}

	checkData_(data) {
		if (!data.hasOwnProperty('genes') || !data.hasOwnProperty('gns') || !data.hasOwnProperty('phylo') || !data.hasOwnProperty('simLinks')) {
			this.emitError_()
			return false
		}
		return true
	}

	emitError_() {
		const errorDiv = d3.select(this.domErrorId_)
		errorDiv.transition()
			.style('display', 'table')
	}

	hideError_() {
		const errorDiv = d3.select(this.domErrorId_)
		errorDiv.transition().style('display', 'none')
	}

}
