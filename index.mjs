import { parse } from '@typescript-eslint/typescript-estree'
import traverse from 'traverse'
import fs from 'fs'
import path from 'path'

async function* walk(dir) {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name)
    if (entry.match(/node_modules/)) {
      continue
    }
    if (d.isDirectory()) yield* walk(entry)
    else if (d.isFile()) yield entry
  }
}

for await (const p of walk('./TypeScript/tests/cases')) {
  if (
    !['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.ctx', '.tsx'].some(
      (ext) => p.endsWith(ext),
    )
  ) {
    continue
  }

  const code = await fs.promises.readFile(path.join('./', p), 'utf8')
  if (
    code.includes('@filename') ||
    code.includes('@Filename') ||
    fs.existsSync(
      `./TypeScript/tests/baselines/reference/${path.basename(p)}.errors.txt`,
    )
  ) {
    continue
  }
  await fs.promises.copyFile(p, path.join('./', p.replace(/^TypeScript\//, '')))

  const writePath = path.parse(path.join('./', p.replace(/^TypeScript\//, '')))
  const writeFile = writePath.dir + '/' + writePath.name + '.json'

  if (!fs.existsSync(writePath.dir)) {
    fs.mkdirSync(writePath.dir, {
      recursive: true,
    })
  }

  try {
    let astJson = parse(code, {
      range: true,
      jsx: p.endsWith('x'),
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
