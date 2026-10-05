import path from 'node:path';

type ResolverOptions = {
  basedir: string;
  defaultResolver: (request: string, options: ResolverOptions) => string;
  rootDir: string;
};

// moduleNameMapper selects the version; only source imports use the wrapper.
// Dependencies retain their own router imports, as they do in Rspack.
export default function resolve(request: string, options: ResolverOptions): string {
  if (/[/\\]reactRouterV[68]\.tsx$/.test(request)) {
    const isSource = ['static', path.join('tests', 'js')].some(directory => {
      const sourceDirectory = path.join(options.rootDir, directory);
      return (
        options.basedir === sourceDirectory ||
        options.basedir.startsWith(sourceDirectory + path.sep)
      );
    });
    if (!isSource) {
      request = 'react-router-dom';
    }
  }
  return options.defaultResolver(request, options);
}
