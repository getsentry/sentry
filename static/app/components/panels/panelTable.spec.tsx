import {render, screen} from 'sentry-test/reactTestingLibrary';

import PanelTable from 'sentry/components/panels/panelTable';

describe('PanelTable', function () {
  const createWrapper = (props = {}) =>
    render(
      <PanelTable headers={['Header 1', 'Header 2', 'Header 3']} {...props}>
        <div data-test-id="cell">Cell 1</div>
        <div data-test-id="cell">Cell 2</div>
        <div data-test-id="cell">Cell 3</div>
      </PanelTable>
    );

  it('renders headers', function () {
    createWrapper();

    expect(screen.getAllByText(/Header [1-3]/)).toHaveLength(3);

    // 3 divs from headers, 3 from "body"
    expect(screen.getAllByTestId('cell')).toHaveLength(3);

    expect(screen.getByText('Header 1')).toBeInTheDocument();
  });

  it('renders loading', function () {
    createWrapper({isLoading: true});

    // Does not render content
    expect(screen.queryByTestId('cell')).not.toBeInTheDocument();

    // renders loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders custom loader', function () {
    createWrapper({
      isLoading: true,
      loader: <span data-test-id="custom-loader">loading</span>,
    });

    // Does not render content
    expect(screen.queryByTestId('cell')).not.toBeInTheDocument();

    // no default loader
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    // has custom loader
    expect(screen.getByTestId('custom-loader')).toBeInTheDocument();
  });

  it('ignores empty state when loading', function () {
    createWrapper({isLoading: true, isEmpty: true});

    // renders loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('There are no items to display')).not.toBeInTheDocument();
  });

  it('renders empty state with custom message', function () {
    createWrapper({isEmpty: true, emptyMessage: 'I am empty inside'});

    // Does not render content
    expect(screen.queryByTestId('cell')).not.toBeInTheDocument();

    // renders empty state
    expect(screen.getByText('I am empty inside')).toBeInTheDocument();
  });

  it('children can be a render function', function () {
    render(
      <PanelTable
        headers={[<div key="1">1</div>, <div key="2">2</div>, <div key="3">3</div>]}
      >
        {() => <p>I am child</p>}
      </PanelTable>
    );

    expect(screen.getByText('I am child')).toBeInTheDocument();
  });
});
