import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  makeAndOp,
  makeHeaderCheckOp,
  makeJsonPathOp,
  makeOrOp,
  makeStatusCodeOp,
} from 'sentry/views/alerts/rules/uptime/assertions/testUtils';
import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';

import {AssertionFailureTree} from './assertionFailureTree';

describe('AssertionFailureTree', () => {
  it('renders rows in order for a simple assertion', () => {
    const assertion: Assertion = {
      root: makeAndOp({
        children: [makeStatusCodeOp({operator: {cmp: 'equals'}, value: 500})],
      }),
    };

    render(<AssertionFailureTree assertion={assertion} />);

    const rows = screen.getAllByTestId('assertion-failure-tree-row');
    expect(rows).toHaveLength(2);

    expect(rows[0]!).toHaveTextContent(/Assert All/);

    const statusText = rows[1]!.textContent ?? '';
    expect(statusText).toMatch(
      /\[Failed\]\s*Status Code \| Rule:[\s\S]*status_code[\s\S]*=[\s\S]*500/
    );
  });

  it('renders rows in order for nested assertions', () => {
    const assertion: Assertion = {
      root: makeAndOp({
        children: [
          makeOrOp({
            children: [
              makeJsonPathOp({
                value: '$.status',
                operator: {cmp: 'equals'},
                operand: {jsonpath_op: 'literal', value: 'ok'},
              }),
              makeHeaderCheckOp({
                key_operand: {header_op: 'literal', value: 'content-type'},
                value_operand: {header_op: 'literal', value: 'application/json'},
              }),
            ],
          }),
        ],
      }),
    };

    render(<AssertionFailureTree assertion={assertion} />);

    const rows = screen.getAllByTestId('assertion-failure-tree-row');
    expect(rows).toHaveLength(3);

    expect(rows[0]!).toHaveTextContent(/Assert Any/);

    expect(rows[1]!).toHaveTextContent(
      /\[Failed\]\s*JSON Path \| Rule:\s*\$\.status\s*=\s*""\s*ok/
    );

    expect(rows[2]!).toHaveTextContent(
      /\[Failed\]\s*Header Check \| Rule:\s*key\s*=\s*""\s*content-type,\s*value\s*=\s*""\s*application\/json/
    );
  });
});
