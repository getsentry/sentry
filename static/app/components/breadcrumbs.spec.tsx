import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';

describe('Breadcrumbs', () => {
  const router = RouterFixture();

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
      {
        router,
        deprecatedRouterMocks: true,
      }
    );
  }

  it('returns null when 0 crumbs', () => {
    const empty = render(<Breadcrumbs crumbs={[]} />, {
      deprecatedRouterMocks: true,
    });

    expect(empty.container).toBeEmptyDOMElement();
  });

  it('renders crumbs with icon', () => {
    createWrapper();
  });

  it('generates correct links', async () => {
    createWrapper();
    await userEvent.click(screen.getByText('Test 1'));
    expect(router.push).toHaveBeenCalledWith('/test1');
    await userEvent.click(screen.getByText('Test 2'));
    expect(router.push).toHaveBeenCalledWith('/test2');
  });

  it('does not make links where no `to` is provided', async () => {
    createWrapper();
    await userEvent.click(screen.getByText('Test 3'));
    expect(router.push).not.toHaveBeenCalled();
  });
});
