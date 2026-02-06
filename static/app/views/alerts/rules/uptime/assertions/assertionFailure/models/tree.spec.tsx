import {
  makeAndOp,
  makeHeaderCheckOp,
  makeJsonPathOp,
  makeNotOp,
  makeOrOp,
  makeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/assertions/testUtils';
import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';

import {Tree} from './tree';

describe('Assertion Failure Tree model', () => {
  it('Builds the expected tree', () => {
    const assertion: Assertion = {
      root: makeAndOp({
        id: 'op-1',
        children: [
          makeStatusCodeOp({id: 'op-2', value: 200}),
          makeOrOp({
            id: 'op-3',
            children: [makeJsonPathOp({id: 'op-4'})],
          }),
          makeNotOp({
            id: 'op-5',
            operand: makeAndOp({
              id: 'op-6',
              children: [makeHeaderCheckOp({id: 'op-7'})],
            }),
          }),
        ],
      }),
    };

    const tree = Tree.FromAssertion(assertion);

    expect(tree.serialize()).toMatchSnapshot();
  });

  it('Merges logical ops - root', () => {
    const assertion: Assertion = {
      root: makeAndOp({
        id: 'op-1',
        children: [
          makeNotOp({
            id: 'op-2',
            operand: makeOrOp({children: [makeStatusCodeOp({id: 'op-3', value: 200})]}),
          }),
        ],
      }),
    };

    const tree = Tree.FromAssertion(assertion);
    expect(tree.serialize()).toMatchSnapshot();
  });

  it('Merges logical ops - non-root', () => {
    const assertion: Assertion = {
      root: makeAndOp({
        id: 'op-1',
        children: [
          makeNotOp({
            id: 'op-2',
            operand: makeAndOp({
              children: [
                makeStatusCodeOp({id: 'op-3', value: 200}),
                makeJsonPathOp({id: 'op-4'}),
              ],
            }),
          }),
        ],
      }),
    };

    const tree = Tree.FromAssertion(assertion);
    expect(tree.serialize()).toMatchSnapshot();
  });
});
