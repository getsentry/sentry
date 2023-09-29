// Taken from https://gist.github.com/iwill/a83038623ba4fef6abb9efca87ae9ccb
// returns -1 for smaller, 0 for equals, and 1 for greater than

import {semverCompare} from './versions';

function testVersion(v1: string, operator: '<' | '>' | '=', v2: string) {
  const result = semverCompare(v1, v2);
  if (operator === '<') {
    expect(result).toBe(-1);
  }
  if (operator === '>') {
    expect(result).toBe(1);
  }
  if (operator === '=') {
    expect(result).toBe(0);
  }
}
describe('semverCompar', () => {
  it('compares versions', () => {
    // 1.0.0 < 2.0.0 < 2.1.0 < 2.1.1
    testVersion('1.0.0', '=', '1.0.0');
    testVersion('1.0.0', '<', '2.0.0');
    testVersion('2.0.0', '<', '2.1.0');
    testVersion('2.1.0', '<', '2.1.1');

    // 1.0.0-alpha < 1.0.0
    testVersion('1.0.0-alpha', '<', '1.0.0');

    // 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0
    testVersion('1.0.0-alpha', '<', '1.0.0-alpha.1');
    testVersion('1.0.0-alpha.1', '<', '1.0.0-alpha.beta');
    testVersion('1.0.0-alpha.beta', '<', '1.0.0-beta');
    testVersion('1.0.0-beta', '<', '1.0.0-beta.2');
    testVersion('1.0.0-beta.2', '<', '1.0.0-beta.11');
    testVersion('1.0.0-beta.11', '<', '1.0.0-rc.1');
    testVersion('1.0.0-rc.1', '<', '1.0.0');
  });
});
