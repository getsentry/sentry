import {
  fireEvent,
  mountWithTheme,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

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
    fireEvent.click(screen.getByText('Test 1'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith('/test1');
    fireEvent.click(screen.getByText('Test 2'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith('/test2');
  });

  it('does not make links where no `to` is provided', () => {
    createWrapper();
    fireEvent.click(screen.getByText('Test 3'));
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
    fireEvent.mouseOver(screen.getByText('dropdown crumb'));

    await waitFor(() => {
      expect(screen.getByText('item3')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('item3'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({label: 'item3'}),
      expect.anything(),
      expect.anything()
    );
  });
});
