'use strict'

const path = require('path')
const fs = require('fs')
const glob = require('glob')

const expect = require('chai').expect
const GeneHoodEngine = require('./GeneHoodEngine')

const testDataPath = path.resolve(__dirname, '..', 'data-test')
const filePathIn = path.resolve(testDataPath, 'flgB.stables.list')
const filePathOut = path.resolve(testDataPath, 'geneHood.pack.json')


describe('GeneHood', function() {
	it('should work', function() {
		process.chdir('./data-test')
		this.timeout(10000)
		const geneHood = new GeneHoodEngine(filePathIn)
		return geneHood.run(14, 14).then(() => {
			const data = fs.readFileSync(filePathOut)
			expect(data).to.not.eql('')
		})
		.catch((err) => {
			throw Error(err)
		})
	})
	after(function() {
		let files = []
		let configFilenamePattern = path.resolve(testDataPath, 'geneHood*')
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