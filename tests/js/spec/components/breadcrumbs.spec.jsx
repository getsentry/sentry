import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Breadcrumbs from 'app/components/breadcrumbs';

describe('Breadcrumbs', () => {
  const routerContext = TestStubs.routerContext();
  afterEach(() => {
    jest.resetAllMocks();
  });

  function createWrapper() {
    return mountWithTheme(
      <Breadcrumbs
        crumbs={[
          {
            label: 'Test 1',
            to: '/test1',
          },
          {
            label: 'Test 2',
            to: '/test2',
          },
          {
            label: 'Test 3',
            to: null,
          },
        ]}
      />,
      {context: routerContext}
    );
  }

  it('returns null when 0 crumbs', () => {
    const empty = mountWithTheme(<Breadcrumbs crumbs={[]} />);

    expect(empty.container).toBeEmptyDOMElement();
  });

  it('renders crumbs with icon', () => {
    const wrapper = createWrapper();
    expect(wrapper.container).toSnapshot();
  });

  it('generates correct links', () => {
    createWrapper();
    userEvent.click(screen.getByText('Test 1'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith('/test1');
    userEvent.click(screen.getByText('Test 2'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith('/test2');
  });

  it('does not make links where no `to` is provided', () => {
    createWrapper();
    userEvent.click(screen.getByText('Test 3'));
    expect(routerContext.context.router.push).not.toHaveBeenCalled();
  });

  it('renders a crumb dropdown', async () => {
    const onSelect = jest.fn();
    mountWithTheme(
      <Breadcrumbs
        crumbs={[
          {
            label: 'dropdown crumb',
            onSelect,
            items: [{label: 'item1'}, {label: 'item2'}, {label: 'item3'}],
          },
          {
            label: 'Test 2',
            to: '/test2',
          },
          {
            label: 'Test 3',
            to: null,
          },
        ]}
      />,
      {context: routerContext}
    );
    userEvent.hover(screen.getByText('dropdown crumb'));

    const item3 = await screen.findByText('item3');
    expect(item3).toBeInTheDocument();

    userEvent.click(item3);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({label: 'item3'}),
      expect.anything(),
      expect.anything()
    );
  });
});
