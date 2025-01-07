import {EventEntryExceptionGroupFixture} from 'sentry-fixture/eventEntryExceptionGroup';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {RelatedExceptions} from 'sentry/components/events/interfaces/crashContent/exception/relatedExceptions';

describe('ExceptionGroupContext', function () {
  const entry = EventEntryExceptionGroupFixture();

  const exceptionGroup1Mechanism = entry.data.values?.find(
    ({type}) => type === 'ExceptionGroup 1'
  )?.mechanism;
  const exceptionGroup2Mechanism = entry.data.values?.find(
    ({type}) => type === 'ExceptionGroup 2'
  )?.mechanism;
  const typeErrorMechanism = entry.data.values?.find(
    ({type}) => type === 'TypeError'
  )?.mechanism;

  const defaultProps = {
    allExceptions: entry.data.values ?? [],
    mechanism: exceptionGroup1Mechanism,
    newestFirst: true,
    onExceptionClick: jest.fn(),
  };

  it('renders tree with exception group', function () {
    render(<RelatedExceptions {...defaultProps} mechanism={exceptionGroup1Mechanism} />);

    const items = screen.getAllByTestId('exception-tree-item');
    expect(items).toHaveLength(3);

    // ExceptionGroup should not link to itself
    expect(within(items[0]!).getByText('ExceptionGroup 1: parent')).toBeInTheDocument();
    // Should have a link to TypeError exception
    expect(
      within(items[1]!).getByRole('button', {name: 'TypeError: nested'})
    ).toBeInTheDocument();
    // Should have a link to child exception group
    expect(
      within(items[2]!).getByRole('button', {name: 'ExceptionGroup 2: child'})
    ).toBeInTheDocument();
  });

  it('sorts children according to sort preference', function () {
    render(
      <RelatedExceptions
        {...defaultProps}
        mechanism={exceptionGroup1Mechanism}
        newestFirst={false}
      />
    );

    const children = screen.getAllByRole('button');

    // Order should be oldest to newest, opposite fo the previous test
    expect(within(children[0]!).getByText(/ExceptionGroup 2/i)).toBeInTheDocument();
    expect(within(children[1]!).getByText(/TypeError/i)).toBeInTheDocument();
  });

  it('renders tree with child exception group', function () {
    render(<RelatedExceptions {...defaultProps} mechanism={exceptionGroup2Mechanism} />);

    const items = screen.getAllByTestId('exception-tree-item');
    expect(items).toHaveLength(3);

    // Should show and link to parent exception group
    expect(
      within(items[0]!).getByRole('button', {name: 'ExceptionGroup 1: parent'})
    ).toBeInTheDocument();
    // Should have a link to child exception group
    expect(within(items[1]!).getByText('ExceptionGroup 2: child')).toBeInTheDocument();
    // Show show and link to child exception
    expect(
      within(items[2]!).getByRole('button', {name: 'ValueError: test'})
    ).toBeInTheDocument();
  });

  it('does not render for sub-exception', function () {
    const {container} = render(
      <RelatedExceptions {...defaultProps} mechanism={typeErrorMechanism} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
