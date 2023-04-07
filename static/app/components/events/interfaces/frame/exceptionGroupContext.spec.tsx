import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ExceptionGroupContext} from 'sentry/components/events/interfaces/frame/exceptionGroupContext';

describe('ExceptionGroupContext', function () {
  const entry = TestStubs.EventEntryExceptionGroup();

  const event = TestStubs.Event({
    entries: [entry],
  });

  const exceptionGroup1Mechanism = entry.data.values?.find(
    ({type}) => type === 'ExceptionGroup 1'
  )?.mechanism;
  const exceptionGroup2Mechanism = entry.data.values?.find(
    ({type}) => type === 'ExceptionGroup 2'
  )?.mechanism;
  const typeErrorMechanism = entry.data.values?.find(
    ({type}) => type === 'TypeError'
  )?.mechanism;

  const defaultProps = {event, isNewestFrame: true, mechanism: exceptionGroup1Mechanism};

  it('renders tree with exception group', function () {
    render(
      <ExceptionGroupContext {...defaultProps} mechanism={exceptionGroup1Mechanism} />
    );

    const items = screen.getAllByTestId('exception-tree-item');
    expect(items).toHaveLength(3);

    // ExceptionGroup should not link to itself
    expect(within(items[0]).getByText('ExceptionGroup 1')).toBeInTheDocument();
    // Should have a link to child exception group
    expect(
      within(items[1]).getByRole('button', {name: 'ExceptionGroup 2'})
    ).toBeInTheDocument();
    // Should have a link to TypeError exception
    expect(within(items[2]).getByRole('button', {name: 'TypeError'})).toBeInTheDocument();
  });

  it('renders tree with child exception group', function () {
    render(
      <ExceptionGroupContext {...defaultProps} mechanism={exceptionGroup2Mechanism} />
    );

    const items = screen.getAllByTestId('exception-tree-item');
    expect(items).toHaveLength(3);

    // Should show and link to parent exception group
    expect(
      within(items[0]).getByRole('button', {name: 'ExceptionGroup 1'})
    ).toBeInTheDocument();
    // Should have a link to child exception group
    expect(within(items[1]).getByText('ExceptionGroup 2')).toBeInTheDocument();
    // Show show and link to child exception
    expect(
      within(items[2]).getByRole('button', {name: 'ValueError'})
    ).toBeInTheDocument();
  });

  it('does not render for sub-exception', function () {
    const {container} = render(
      <ExceptionGroupContext {...defaultProps} mechanism={typeErrorMechanism} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
