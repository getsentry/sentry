import assert from 'node:assert';
import {describe, it} from 'node:test';

import {normalizePropertyName} from './normalizePropertyName.mjs';

describe('normalizePropertyName', () => {
  it('converts camelCase to kebab-case', () => {
    assert.strictEqual(normalizePropertyName('backgroundColor'), 'background-color');
    assert.strictEqual(
      normalizePropertyName('textDecorationColor'),
      'text-decoration-color'
    );
    assert.strictEqual(normalizePropertyName('borderTopColor'), 'border-top-color');
  });

  it('keeps simple property names unchanged', () => {
    assert.strictEqual(normalizePropertyName('color'), 'color');
    assert.strictEqual(normalizePropertyName('fill'), 'fill');
    assert.strictEqual(normalizePropertyName('stroke'), 'stroke');
  });

  it('keeps kebab-case properties unchanged (lowercased)', () => {
    assert.strictEqual(normalizePropertyName('border-color'), 'border-color');
    assert.strictEqual(normalizePropertyName('background-color'), 'background-color');
  });

  it('handles vendor prefixes', () => {
    assert.strictEqual(
      normalizePropertyName('-webkit-text-fill-color'),
      '-webkit-text-fill-color'
    );
    assert.strictEqual(
      normalizePropertyName('-webkit-text-stroke-color'),
      '-webkit-text-stroke-color'
    );
  });

  it('handles CSS custom properties', () => {
    assert.strictEqual(normalizePropertyName('--my-color'), '--my-color');
    assert.strictEqual(normalizePropertyName('--Custom-Prop'), '--custom-prop');
  });

  it('lowercases mixed-case kebab input', () => {
    assert.strictEqual(normalizePropertyName('Background-Color'), 'background-color');
  });
});
