/* eslint-env node */
/* eslint import/no-nodejs-modules:off */

import fs from 'fs';

import {glob} from 'glob';
import prettier from 'prettier';
import SignedSource from 'signedsource';
import webpack from 'webpack';

type GlobPattern = Parameters<typeof glob>[0];
type Options = {
  cwd: string;
  output: string;
  pattern: GlobPattern;
};

abstract class SignedFileGenerator<Data> {
  name: string;
  isWatchMode: boolean = false;

  cwd: string;
  pattern: GlobPattern;
  output: string;

  constructor(name: string, {cwd, pattern, output}: Options) {
    this.name = name;

    this.cwd = cwd;
    this.pattern = pattern;
    this.output = output;
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.watchRun.tapAsync(this.name, async (_, callback) => {
      this.isWatchMode = true;
      await this.build();
      callback();
    });

    compiler.hooks.beforeRun.tapAsync(this.name, async (_, callback) => {
      if (this.isWatchMode) {
        callback();
        return;
      }

      await this.build();
      callback();
    });
  }

  async build() {
    const files = await this.findFiles();
    const data = await this.generateData(files);
    const content = this.sourceTemplate(data, SignedSource.getSigningToken());
    const formatted = await this.formatSource(content);
    const signed = SignedSource.signFile(formatted);

    if (this.isChanged(signed)) {
      this.writeFile(signed);
    }
  }

  async findFiles() {
    const files = await glob(this.pattern, {
      cwd: this.cwd,
    });

    return files;
  }

  abstract generateData(files: string[]): Promise<Data> | Data;

  abstract sourceTemplate(data: Data, signingToken: string): string;

  async formatSource(unformatted: string) {
    const config = await prettier.resolveConfig(this.output);
    if (config) {
      return prettier.format(unformatted, {...config, parser: 'babel'});
    }
    return unformatted;
  }

  isChanged(signed: string) {
    try {
      const origContent = fs.readFileSync(this.output, 'utf8');
      return origContent !== signed;
    } catch {
      return true;
    }
  }

  writeFile(content: string) {
    const tmpFile = this.output + '.tmp';

    fs.writeFileSync(tmpFile, content);
    fs.renameSync(tmpFile, this.output);
  }
}

export default SignedFileGenerator;
