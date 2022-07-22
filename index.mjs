import { parse } from '@typescript-eslint/typescript-estree'
import traverse from 'traverse'
import fs from 'fs'
import path from 'path'
import glob from 'glob'

let extensions = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'ctx', 'tsx'].join(',')
let globPath = `./TypeScript/tests/cases/@(compiler|conformance)/**/*.{${extensions}}`

for await (const p of glob.sync(globPath)) {
  const filePath = p.replace(/^TypeScript\//, './')
  const writePath = path.parse(filePath)
  const writeFile = writePath.dir + '/' + writePath.name + '.json'

  const code = await fs.promises.readFile(path.join('./', p), 'utf8')

  // skip multi-file files
  if (/@filename/i.test(code)) {
    if (fs.existsSync(writeFile)) {
      fs.unlinkSync(writeFile)
    }
    continue
  }

  // error files have path like "importMeta(module=es2020,target=es5).errors.txt"
  let errorsPath = `./TypeScript/tests/baselines/reference/${path.basename(p).split('.')[0]}*.errors.txt`
  if (glob.sync(errorsPath).length > 0) {
    if (fs.existsSync(writeFile)) {
      fs.unlinkSync(writeFile)
    }
    continue
  }

  await fs.promises.copyFile(p, filePath)

  if (!fs.existsSync(writePath.dir)) {
    fs.mkdirSync(writePath.dir, {
      recursive: true,
    })
  }

  try {
    let astJson = parse(code, {
      range: true,
    })

    const bigIntSerializer = (_key, value) => {
      return typeof value === 'bigint' ? value.toString() + 'n' : value
    }

    astJson = JSON.parse(JSON.stringify(astJson, bigIntSerializer))

    astJson.sourceType = 'module'

    // omit the raw field, which is useless for test comparisons
    traverse(astJson).forEach((node) => {
      if (node && node.type === 'Literal') {
        delete node.raw
        if (node.bigint) {
          delete node.bigint
        }
      }
      if (node && node.range) {
        node.start = node.range[0]
        node.end = node.range[1]
        delete node.range
      }
    })

    await fs.promises.writeFile(
      writeFile,
      JSON.stringify(astJson, bigIntSerializer, 2),
    )
  } catch (err) {
    if (fs.existsSync(writeFile)) {
      fs.unlinkSync(writeFile)
      console.log('Removed: ', writeFile)
    }
    console.log(p)
    console.log(err.message)
  }
}

console.log('Done.')
