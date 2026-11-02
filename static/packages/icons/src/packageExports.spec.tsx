interface PackageJson {
  exports: Record<string, string>;
  publishConfig: {exports: Record<string, {import: string; types: string}>};
}

const packageJson = jest.requireActual<PackageJson>('../package.json');

describe('package exports', () => {
  it('publishes a built entry for every source export', () => {
    const expected = Object.fromEntries(
      Object.entries(packageJson.exports).map(([subpath, source]) => {
        const built = source.replace(/^\.\/src\//, './dist/').replace(/\.tsx?$/, '');
        return [subpath, {types: `${built}.d.ts`, import: `${built}.js`}];
      })
    );

    expect(packageJson.publishConfig.exports).toEqual(expected);
  });
});
