'use strict'

const path = require('path')
const fs = require('fs')
const glob = require('glob')

const expect = require('chai').expect
const GeneHoodEngine = require('./GeneHoodEngine')

const testDataPath = path.resolve(__dirname, '..', 'data-test')
const filePathIn = path.resolve(testDataPath, 'flgB.stables.list')
const filePathOut = path.resolve(testDataPath, 'geneHood.pack.json')


describe.only('GeneHood', function() {
	this.timeout(120000)
	let dataParsed = {}
	before(() => {
		return new Promise((resolve) => {
			process.chdir('./data-test')
			const geneHood = new GeneHoodEngine(filePathIn)
			return geneHood.run(14, 14).then(() => {
				const data = fs.readFileSync(filePathOut)
				dataParsed = JSON.parse(data)
				resolve()
			})
		})
	})
	it('should not be empty', function() {
		expect(dataParsed).to.not.eql('')
	})
	it('should have genes', function() {
		expect(dataParsed).to.have.property('genes')
	})
	it('should have gns', function() {
		expect(dataParsed).to.have.property('gns')
	})
	it('should have simLinks', function() {
		expect(dataParsed).to.have.property('simLinks')
	})
	it('should have phylo', function() {
		expect(dataParsed).to.have.property('phylo')
	})
	it('should not have -1 in any gns.cluster', function() {
		dataParsed.gns.forEach((gn) => {
			expect(gn.cluster).to.not.include(-1)
		})
	})
	it('should not have refStrand in gns', function() {
		dataParsed.gns.forEach((gn) => {
			expect(gn).to.have.property('refStrand')
		})
	})
	it('should not have span in gns', function() {
		dataParsed.gns.forEach((gn) => {
			expect(gn).to.have.property('span')
		})
	})
	it('should make a mock tree', function() {
		const expectedMockTree = "(GCF_000196175.1-BD_RS15585, GCF_000006765.1-PA1077, GCF_000006765.1-PA1105, GCF_000008485.1-lpg1216)"
		expect(dataParsed.phylo).eql(expectedMockTree)
	})
	after(function() {
		let files = []
		let configFilenamePattern = path.resolve(testDataPath, 'geneHood*json')
		files = files.concat(glob.glob.sync(configFilenamePattern))
		configFilenamePattern = path.resolve(testDataPath, 'gndb.*')
		files = files.concat(glob.glob.sync(configFilenamePattern))
		configFilenamePattern = path.resolve(testDataPath, 'blastp.*')
		files = files.concat(glob.glob.sync(configFilenamePattern))
		files.forEach(function(file) {
			fs.unlinkSync(file)
		})
	})
})
