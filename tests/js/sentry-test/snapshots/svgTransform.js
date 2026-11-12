// eslint-disable-next-line import/no-nodejs-modules -- Jest runs asset transforms in Node.
import {Buffer} from 'node:buffer';

const transform = {
  /** @param {string} source */
  process(source) {
    const url = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
    return {code: `module.exports = ${JSON.stringify(url)};`};
  },
};

// eslint-disable-next-line @sentry/no-default-exports -- Jest loads transforms through their default export.
export default transform;
