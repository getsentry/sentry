import webpack from 'webpack';

type Builder = {build: () => void};

type Options = {
  builder: Builder;
  name: string;
};

export default class FileBuilderPlugin {
  name: string;
  builder: Builder;
  isWatchMode: boolean = false;

  constructor({name, builder}: Options) {
    this.name = name;
    this.builder = builder;
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.watchRun.tapAsync(this.name, async (_, callback) => {
      this.isWatchMode = true;
      await this.builder.build();
      callback();
    });

    compiler.hooks.beforeRun.tapAsync(this.name, async (_, callback) => {
      if (this.isWatchMode) {
        callback();
        return;
      }

      await this.builder.build();
      callback();
    });
  }
}
