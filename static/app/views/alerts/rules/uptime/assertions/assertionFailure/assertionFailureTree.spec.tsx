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
  it('renders simple assertion', () => {
    const assertion: Assertion = {
      root: makeAndOp({
        children: [makeStatusCodeOp({operator: {cmp: 'equals'}, value: 500})],
      }),
    };

    render(<AssertionFailureTree assertion={assertion} />);

    expect(screen.getByText('Assert All')).toBeInTheDocument();
    expect(screen.getByText('[Failed]')).toBeInTheDocument();
    expect(screen.getByText(/Status Code \| Rule:/)).toBeInTheDocument();
    expect(screen.getByText(/status_code/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('renders nested assertions', () => {
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

    expect(screen.getByText('Assert All')).toBeInTheDocument();
    expect(screen.getByText('Assert Any')).toBeInTheDocument();

    expect(screen.getByText(/JSON Path \| Rule:/)).toBeInTheDocument();
    expect(screen.getByText('$.status')).toBeInTheDocument();

    expect(screen.getByText(/Header Check \| Rule:/)).toBeInTheDocument();
    expect(screen.getByText(/content-type/)).toBeInTheDocument();
    expect(screen.getByText(/application\/json/)).toBeInTheDocument();
  });
});
