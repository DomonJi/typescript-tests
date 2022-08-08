import { parse } from "@typescript-eslint/typescript-estree";
import traverse from "traverse";
import fs from "fs";
import path from "path";
import glob from "glob";

let extensions = ["js", "mjs", "cjs", "jsx", "ts", "mts", "ctx", "tsx"];
let globPath = `./TypeScript/tests/cases/@(compiler|conformance)/**/*.{${extensions.join(
  ","
)}}`;

for await (const readFile of glob.sync(globPath)) {
  const writeFile = readFile
    .replace(/^.\/TypeScript/, ".")
    .replace(new RegExp(`.(${extensions.join("|")})$`), ".json");
  const readPath = path.parse(readFile);
  const writePath = path.parse(writeFile);

  const code = await fs.promises.readFile(readFile, "utf8");

  // skip multi-file files
  if (/@filename/i.test(code)) {
    if (fs.existsSync(writePath)) {
      fs.unlinkSync(writePath);
    }
    continue;
  }

  // error files have path like "importMeta(module=es2020,target=es5).errors.txt"
  const errorsPath = `./TypeScript/tests/baselines/reference/${readPath.name}*.errors.txt`;
  if (glob.sync(errorsPath).length > 0) {
    if (fs.existsSync(writePath)) {
      fs.unlinkSync(writePath);
    }
    continue;
  }

  if (!fs.existsSync(writePath.dir)) {
    fs.mkdirSync(writePath.dir, {
      recursive: true,
    });
  }

  await fs.promises.copyFile(readFile, readFile.replace(/^.\/TypeScript/, "."));

  try {
    let astJson = parse(code, {
      range: true,
    });

    const bigIntSerializer = (_key, value) => {
      return typeof value === "bigint" ? value.toString() + "n" : value;
    };

    astJson = JSON.parse(JSON.stringify(astJson, bigIntSerializer));

    astJson.sourceType = "module";

    // omit the raw field, which is useless for test comparisons
    traverse(astJson).forEach((node) => {
      if (node && node.type === "Literal") {
        delete node.raw;
        if (node.bigint) {
          delete node.bigint;
        }
      }
      if (node && node.range) {
        node.start = node.range[0];
        node.end = node.range[1];
        delete node.range;
      }
    });

    await fs.promises.writeFile(
      writeFile,
      JSON.stringify(astJson, bigIntSerializer, 2)
    );
  } catch (err) {
    if (fs.existsSync(writePath)) {
      fs.unlinkSync(writePath);
      console.log("Removed: ", writePath);
    }
    console.log(err.message);
  }
}

console.log("Done.");
