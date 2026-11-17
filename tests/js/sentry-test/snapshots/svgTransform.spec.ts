/* eslint-disable import/no-nodejs-modules -- Asset transforms execute in Node. */
import {Buffer} from 'node:buffer';
import {runInNewContext} from 'node:vm';

import transform from './svgTransform';

describe('snapshot SVG transform', () => {
  it('pauses image animations while preserving their negative delays and artwork', () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg"><style>circle{animation:rise 10s linear infinite;animation-delay:-3s}</style><circle r="10"/></svg>';
    const module = {exports: ''};
    runInNewContext(transform.process(source).code, {module});

    const decoded = Buffer.from(
      module.exports.slice('data:image/svg+xml;base64,'.length),
      'base64'
    ).toString();
    expect(module.exports).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(decoded).toContain(source.replace('</svg>', ''));
    expect(decoded).toContain('animation-play-state:paused!important');
    expect(decoded).toContain('transition:none!important');
    expect(decoded).toMatch(/<\/style><\/svg>$/);
  });

  it('keeps a self-closing empty SVG valid', () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const module = {exports: ''};
    runInNewContext(transform.process(source).code, {module});

    expect(
      Buffer.from(
        module.exports.slice('data:image/svg+xml;base64,'.length),
        'base64'
      ).toString()
    ).toBe(source);
  });
});
