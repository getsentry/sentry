/* eslint import/no-nodejs-modules:0 */
import fs from 'fs';

export function loadFixtures(dir) {
  // Dynamically load fixtures
  const modules = fs.readdirSync(dir).map(filename => require(`${dir}/${filename}`));

  modules.forEach(exports => {
    if (Object.keys(exports).includes('default')) {
      throw new Error('Javascript fixtures cannot use default export');
    }
  });

  const fixtures = modules.reduce(
    (acc, exports) => ({
      ...acc,
      ...exports,
    }),
    {}
  );

  return fixtures;
}
