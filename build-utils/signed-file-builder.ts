/* eslint-env node */
/* eslint import/no-nodejs-modules:off */

import fs from 'fs';

import SignedSource from 'signedsource';

type Options = {
  cwd: string;
  output: string;
};

export default abstract class SignedFileBuilder {
  cwd: string;
  output: string;

  constructor({cwd, output}: Options) {
    this.cwd = cwd;
    this.output = output;
  }

  /**
   * Construct file contents, including the signing token.
   */
  protected abstract generateFileContent(signingToken: string): Promise<string>;

  /**
   * Build the file, and ensure it's updated on disk.
   */
  public async build() {
    const content = await this.generateFileContent(SignedSource.getSigningToken());
    const signed = SignedSource.signFile(content);
    if (this.isChanged(signed)) {
      this.writeFile(signed);
    }
  }

  /**
   * Verify that the existing file on disk is not modified.
   */
  public validate() {
    const content = fs.readFileSync(this.output, {encoding: 'utf8'});
    return SignedSource.verifySignature(content);
  }

  private isChanged(signed: string) {
    try {
      const origContent = fs.readFileSync(this.output, 'utf8');
      return origContent !== signed;
    } catch {
      return true;
    }
  }

  private writeFile(content: string) {
    const tmpFile = this.output + '.tmp';

    fs.writeFileSync(tmpFile, content);
    fs.renameSync(tmpFile, this.output);
  }
}
