import isRegExp from 'lodash/isRegExp';

export function createAssetsFilter(excludePatterns) {
  const excludeFunctions = (
    Array.isArray(excludePatterns) ? excludePatterns : [excludePatterns]
  )
    .filter(Boolean)
    .map(pattern => {
      if (typeof pattern === 'string') {
        pattern = new RegExp(pattern, 'u');
      }

      if (isRegExp(pattern)) {
        return asset => pattern.test(asset);
      }

      if (typeof pattern !== 'function') {
        throw new TypeError(
          `Pattern should be either string, RegExp or a function, but "${JSON.parse(
            pattern,
            {depth: 0}
          )}" got.`
        );
      }

      return pattern;
    });

  if (excludeFunctions.length) {
    return asset => excludeFunctions.every(fn => fn(asset) !== true);
  }
  return () => true;
}
