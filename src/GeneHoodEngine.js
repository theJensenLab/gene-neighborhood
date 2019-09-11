'use strict'

const fs = require('fs')
const childProcess = require('child_process')
const bunyan = require('bunyan')
const through2 = require('through2')

const Blastinutils = require('blastinutils')
const commandTk = new Blastinutils.CommandsToolKit()

const gh = require('./GeneHoodFromStableList')
const GeneHoodObject = require('./GeneHoodObject')

const dbFile = 'gndb'
const outFile = 'blastp.genehood.dat'

const makeDB_ = (fastaFile) => {
	const command = commandTk.buildMakeDatabaseCommand(fastaFile, dbFile)
	return new Promise((resolve, reject) => {
		childProcess.exec(command, (error, stdout, stderr) => {
			if (error) {
				reject(error)
				return
			}
			resolve()
		})
	})
}

const runBlast_ = (fastaFile) => {
	const command = commandTk.buildBlastpCommand(dbFile, fastaFile, outFile)
	return new Promise((resolve, reject) => {
		childProcess.exec(command, (error, stdout, stderr) => {
			if (error) {
				reject(error)
				return
			}
			resolve(outFile)
		})
	})
}

const parseBlastOutPut = (blastOutFile) => {
	return new Promise((resolve, reject) => {
		let buffer = ''
		const blastResults = []
		const nodesNlinks = new Blastinutils.NodesAndLinksStream()
		fs.createReadStream(blastOutFile)
			.pipe(nodesNlinks)
			.on('finish', () => {
				resolve({
					nodes: nodesNlinks.nodes,
					links: nodesNlinks.links
				})
			})
			.on('error', (err) => {
				throw err
			})
	})
}

module.exports =
class GeneHoodEngine {
	constructor(stableIdFile, phyloFile = null, packedFile = 'geneHood.pack.json', tempFastaFile = 'geneHood.fa', tempGeneFile = 'geneHood.gene.json') {
		this.stableIdFile_ = stableIdFile
		this.phyloFile_ = phyloFile
		this.phyloTree = ""
		this.packedFile_ = packedFile
		this.tempFastaFile_ = tempFastaFile
		this.tempGeneFile_ = tempGeneFile
		this.log = bunyan.createLogger({
			name: 'gene-hood-engine'
		})
	}

	buildMockPhylogeny() {
		const mockTree = fs.readFileSync(this.stableIdFile_).toString().split('\n').join(', ')
		this.phyloTree = `(${mockTree})`
		return this
	}

	run(downstream, upstream) {
		this.log.info('Fetching sequences')
		this.buildMockPhylogeny()
		return gh.fetch(this.stableIdFile_, this.tempFastaFile_, this.tempGeneFile_, downstream, upstream)
			.then(() => {
				this.log.info(`Making BLAST database from ${this.tempFastaFile_}`)
				return makeDB_(this.tempFastaFile_)
			})
			.catch((err) => {
				throw err
			})
			.then(() => {
				this.log.info(`Running BLAST on ${this.tempFastaFile_}`)
				return runBlast_(this.tempFastaFile_)
			})
			.then((outBlastFile) => {
				this.log.info('Parsing BLAST data')
				return parseBlastOutPut(outBlastFile, this.tempGeneFile_)
			})
			.then((nodesNlinks) => {
				this.log.info('Packing results')
				const geneHoodObject = new GeneHoodObject()
				const gnData = JSON.parse(fs.readFileSync(this.tempGeneFile_))
				let phyloTree = this.phyloTree
				if (this.phyloFile_)
					phyloTree = fs.readFileSync(this.phyloFile_).toString()
				geneHoodObject.build(gnData, nodesNlinks, phyloTree)
				this.log.info('Saving results')
				fs.writeFileSync(this.packedFile_, JSON.stringify(geneHoodObject.export(), null, ' '))
			})
			.catch((err) => {
				throw err
			})
			.then(() => {
				this.log.info('All done')
			})
	}
}
