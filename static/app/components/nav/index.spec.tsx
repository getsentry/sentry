import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import Nav from 'sentry/components/nav';
import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';

jest.mock('sentry/actionCreators/account');
jest.mock('sentry/utils/useServiceIncidents');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = jest.mocked(useLocation);

const ALL_AVAILABLE_FEATURES = [
  'insights-entry-points',
  'discover',
  'discover-basic',
  'discover-query',
  'dashboards-basic',
  'dashboards-edit',
  'custom-metrics',
  'user-feedback-ui',
  'session-replay-ui',
  'performance-view',
  'performance-trace-explorer',
  'starfish-mobile-ui-module',
  'profiling',
];

describe('Nav', function () {
  const organization = OrganizationFixture();
  const user = UserFixture();

  const getElement = () => <Nav />;

  const renderNav = ({organization: org}: {organization: Organization | null}) =>
    render(getElement(), {organization: org});

  const renderNavWithFeatures = (features: string[] = []) => {
    return renderNav({
      organization: {
        ...organization,
        features: [...organization.features, ...features],
      },
    });
  };

  beforeEach(function () {
    mockUseLocation.mockReturnValue(LocationFixture());
  });

  afterEach(function () {
    mockUseLocation.mockReset();
  });

  it('renders', async function () {
    renderNav({organization});
    expect(
      await screen.findByRole('navigation', {name: 'Primary Navigation'})
    ).toBeInTheDocument();
  });

  describe('sidebar links', () => {
    beforeEach(function () {
      ConfigStore.init();
      ConfigStore.set('features', new Set([]));
      ConfigStore.set('user', user);

      mockUseLocation.mockReturnValue({...LocationFixture()});
    });
    afterEach(() => ConfigStore.reset());
    it('renders navigation', function () {
      renderNav({organization});

      expect(
        screen.getByRole('navigation', {name: 'Primary Navigation'})
      ).toBeInTheDocument();
    });

    it('renders all features', function () {
      renderNavWithFeatures([...ALL_AVAILABLE_FEATURES]);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(8);

      [
        'Issues',
        'Projects',
        'Explore',
        'Insights',
        'Perf.',
        'Boards',
        'Alerts',
        'Settings',
      ].forEach((title, index) => {
        expect(links[index]).toHaveAccessibleName(title);
      });
    });
  });
});
