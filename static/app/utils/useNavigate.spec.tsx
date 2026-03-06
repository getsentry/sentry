import {useEffect} from 'react';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {useNavigate} from 'sentry/utils/useNavigate';

describe('useNavigate', () => {
  const configState = ConfigStore.getState();

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  it('returns the navigate function', () => {
    let navigate: ReturnType<typeof useNavigate> | undefined = undefined;

    function HomePage() {
      navigate = useNavigate();
      return null;
    }

    render(<HomePage />);

    expect(typeof navigate).toBe('function');
  });

  it('applies url normalization for customer-domains', () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'albertos-apples',
      organizationUrl: 'https://albertos-apples.sentry.io',
      sentryUrl: 'https://sentry.io',
    });

    function HomePage() {
      const navigate = useNavigate();
      useEffect(() => {
        navigate('/organizations/acme/issues/');
      }, [navigate]);

      return null;
    }

    const {router} = render(<HomePage />, {
      initialRouterConfig: {
        location: {pathname: '/organizations/acme/issues/'},
      },
    });

    return waitFor(() => {
      expect(router.location.pathname).toBe('/issues/');
    });
  });
});
