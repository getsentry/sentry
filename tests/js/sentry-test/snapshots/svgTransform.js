// eslint-disable-next-line import/no-nodejs-modules -- Jest runs asset transforms in Node.
import {Buffer} from 'node:buffer';

const transform = {
  /** @param {string} source */
  process(source) {
    // Page CSS cannot reach SVG images; pause inside them to preserve negative-delay frames.
    const pausedSource = source.replace(
      '</svg>',
      '<style>*{animation-play-state:paused!important;transition:none!important}</style></svg>'
    );
    const url = `data:image/svg+xml;base64,${Buffer.from(pausedSource).toString('base64')}`;
    return {code: `module.exports = ${JSON.stringify(url)};`};
  },
};

// eslint-disable-next-line @sentry/no-default-exports -- Jest loads transforms through their default export.
export default transform;
