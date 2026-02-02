import {render, screen, within} from 'sentry-test/reactTestingLibrary';

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

    expect(within(rows[0]!).getByText('Assert All')).toBeInTheDocument();

    expect(within(rows[1]!).getByText('[Failed]')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/Status Code \| Rule:/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/status_code/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/=/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/500/)).toBeInTheDocument();
  });

  it('renders rows in order for nested assertions', () => {
    const assertion: Assertion = {
      root: makeAndOp({
        children: [
          makeOrOp({
            children: [
              makeJsonPathOp({value: '$.status'}),
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
    expect(rows).toHaveLength(4);

    expect(within(rows[0]!).getByText('Assert All')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Assert Any')).toBeInTheDocument();

    expect(within(rows[2]!).getByText('[Failed]')).toBeInTheDocument();
    expect(within(rows[2]!).getByText(/JSON Path \| Rule:/)).toBeInTheDocument();
    expect(within(rows[2]!).getByText('$.status')).toBeInTheDocument();

    // Two ="" labels, for the key and value comparisons
    const headerOps = rows[3]!.textContent?.match(/=\s*""/g) ?? [];
    expect(headerOps).toHaveLength(2);

    expect(within(rows[3]!).getByText('[Failed]')).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/Header Check \| Rule:/)).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/key/)).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/content-type/)).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/value/)).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/application\/json/)).toBeInTheDocument();
  });
});
