import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';

describe('Breadcrumbs', () => {
  const routerContext = RouterContextFixture();

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createWrapper() {
    return render(
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
    const empty = render(<Breadcrumbs crumbs={[]} />);

    expect(empty.container).toBeEmptyDOMElement();
  });

  it('renders crumbs with icon', () => {
    createWrapper();
  });

  it('generates correct links', async () => {
    createWrapper();
    await userEvent.click(screen.getByText('Test 1'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith('/test1');
    await userEvent.click(screen.getByText('Test 2'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith('/test2');
  });

  it('does not make links where no `to` is provided', async () => {
    createWrapper();
    await userEvent.click(screen.getByText('Test 3'));
    expect(routerContext.context.router.push).not.toHaveBeenCalled();
  });

  it('renders a crumb dropdown', async () => {
    const onSelect = jest.fn();
    render(
      <Breadcrumbs
        crumbs={[
          {
            label: 'dropdown crumb',
            onSelect,
            items: [
              {index: 0, value: 'item1', label: 'item1'},
              {index: 1, value: 'item2', label: 'item2'},
              {index: 2, value: 'item3', label: 'item3'},
            ],
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
    await userEvent.hover(screen.getByText('dropdown crumb'));

    const item3 = await screen.findByText('item3');
    expect(item3).toBeInTheDocument();

    await userEvent.click(item3);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({label: 'item3'}));
  });
});
