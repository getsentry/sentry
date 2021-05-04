import {mountWithTheme} from 'sentry-test/enzyme';

import PanelTable from 'app/components/panels/panelTable';

describe('PanelTable', function () {
  const createWrapper = (props = {}) =>
    mountWithTheme(
      <PanelTable
        headers={[<div key="1">1</div>, <div key="2">2</div>, <div key="3">3</div>]}
        {...props}
      >
        <div data-test-id="cell">Cell 1</div>
        <div data-test-id="cell">Cell 2</div>
        <div data-test-id="cell">Cell 3</div>
      </PanelTable>
    );

  it('renders headers', function () {
    const wrapper = createWrapper();

    expect(wrapper.find('PanelTableHeader')).toHaveLength(3);

    // 3 divs from headers, 3 from "body"
    expect(wrapper.find('[data-test-id="cell"]')).toHaveLength(3);

    expect(wrapper.find('PanelTableHeader').at(0).text()).toBe('1');
  });

  it('renders loading', function () {
    const wrapper = createWrapper({isLoading: true});

    // Does not render content
    expect(wrapper.find('[data-test-id="cell"]')).toHaveLength(0);

    // renders loading
    expect(wrapper.find('LoadingIndicator')).toBeDefined();
  });

  it('renders custom loader', function () {
    const wrapper = createWrapper({
      isLoading: true,
      loader: <span data-test-id="custom-loader">loading</span>,
    });

    // Does not render content
    expect(wrapper.find('[data-test-id="cell"]')).toHaveLength(0);

    // no default loader
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);

    // has custom loader
    expect(wrapper.find('[data-test-id="custom-loader"]')).toHaveLength(1);
  });

  it('ignores empty state when loading', function () {
    const wrapper = createWrapper({isLoading: true, isEmpty: true});

    // renders loading
    expect(wrapper.find('LoadingIndicator')).toBeDefined();
    expect(wrapper.find('EmptyStateWarning')).toHaveLength(0);
  });

  it('renders empty state with custom message', function () {
    const wrapper = createWrapper({isEmpty: true, emptyMessage: 'I am empty inside'});

    // Does not render content
    expect(wrapper.find('[data-test-id="cell"]')).toHaveLength(0);

    // renders empty state
    expect(wrapper.find('EmptyStateWarning').text()).toBe('I am empty inside');
  });

  it('children can be a render function', function () {
    const wrapper = mountWithTheme(
      <PanelTable
        headers={[<div key="1">1</div>, <div key="2">2</div>, <div key="3">3</div>]}
      >
        {() => <p>I am child</p>}
      </PanelTable>
    );

    expect(wrapper.find('p').text()).toBe('I am child');
  });
});
