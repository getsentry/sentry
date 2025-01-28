import {useRef} from 'react';
import {useSearchParams} from 'react-router-dom';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import Link from 'sentry/components/links/link';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

describe('rerender', () => {
  // Taken from https://testing-library.com/docs/example-update-props/
  let idCounter = 1;

  function NumberDisplay({number}: {number: number}) {
    const id = useRef(idCounter++); // to ensure we don't remount a different instance

    return (
      <div>
        <span data-test-id="number-display">{number}</span>
        <span data-test-id="instance-id">{id.current}</span>
      </div>
    );
  }

  test('calling render with the same component on the same container does not remount', () => {
    const {rerender} = render(<NumberDisplay number={1} />);
    expect(screen.getByTestId('number-display')).toHaveTextContent('1');

    // re-render the same component with different props
    rerender(<NumberDisplay number={2} />);
    expect(screen.getByTestId('number-display')).toHaveTextContent('2');

    expect(screen.getByTestId('instance-id')).toHaveTextContent('1');
  });
});

describe('disableRouterMocks', () => {
  it('starts with the correct initial location', () => {
    const {router} = render(<div />, {
      disableRouterMocks: true,
      initialRouterConfig: {location: '/foo/'},
    });

    expect(router.location.pathname).toBe('/foo/');
  });

  it('should react to clicking a Link', async () => {
    function TestComp() {
      const location = useLocation();

      return (
        <div>
          <Link to="/foo/bar/">Click me</Link>
          <div>You are at: {location.pathname}</div>
        </div>
      );
    }

    const {router} = render(<TestComp />, {
      disableRouterMocks: true,
    });

    const link = screen.getByText('Click me');
    await userEvent.click(link);

    expect(await screen.findByText('You are at: /foo/bar/')).toBeInTheDocument();
    expect(router.location.pathname).toBe('/foo/bar/');
  });

  it('should react to useNavigate()', async () => {
    function TestComp() {
      const location = useLocation();
      const navigate = useNavigate();

      return (
        <div>
          <button onClick={() => navigate('/foo/bar/')}>Click me</button>
          <div>You are at: {location.pathname}</div>
        </div>
      );
    }

    const {router} = render(<TestComp />, {
      disableRouterMocks: true,
    });

    const button = screen.getByText('Click me');
    await userEvent.click(button);

    expect(await screen.findByText('You are at: /foo/bar/')).toBeInTheDocument();
    expect(router.location.pathname).toBe('/foo/bar/');
  });

  it('can navigate in the test', async () => {
    function TestComp() {
      const location = useLocation();

      return <div>{location.pathname}</div>;
    }

    const {router} = render(<TestComp />, {disableRouterMocks: true});

    expect(screen.getByText('/mock-pathname/')).toBeInTheDocument();

    // Navigate to a new path
    router.navigate('/foo/bar/');

    await waitFor(() => {
      expect(router.location.pathname).toBe('/foo/bar/');
    });

    expect(screen.getByText('/foo/bar/')).toBeInTheDocument();

    // Navigate back to the previous path
    router.navigate(-1);

    await waitFor(() => {
      expect(router.location.pathname).toBe('/mock-pathname/');
    });

    expect(screen.getByText('/mock-pathname/')).toBeInTheDocument();
  });

  it('works with useParams()', async () => {
    function TestComp() {
      const params = useParams<{projectId: string}>();

      return <div>{params.projectId}</div>;
    }

    render(<TestComp />, {
      disableRouterMocks: true,
      initialRouterConfig: {
        route: '/projects/:projectId/',
        location: '/projects/123/',
      },
    });

    expect(await screen.findByText('123')).toBeInTheDocument();
  });

  it('works with useSearchParams()', async () => {
    function TestComp() {
      const [searchParams, setSearchParams] = useSearchParams();

      return (
        <div>
          <button onClick={() => setSearchParams({id: '200', name: 'Jane Doe'})}>
            Click me
          </button>
          <div>ID: {searchParams.get('id') ?? 'None'}</div>
          <div>Name: {searchParams.get('name') ?? 'None'}</div>
        </div>
      );
    }

    const {router} = render(<TestComp />, {
      disableRouterMocks: true,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          query: {
            id: '100',
            name: 'John Doe',
          },
        },
      },
    });

    expect(await screen.findByText('ID: 100')).toBeInTheDocument();
    expect(screen.getByText('Name: John Doe')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Click me'));

    expect(await screen.findByText('ID: 200')).toBeInTheDocument();
    expect(screen.getByText('Name: Jane Doe')).toBeInTheDocument();

    expect(router.location.query).toEqual({id: '200', name: 'Jane Doe'});
  });
});
