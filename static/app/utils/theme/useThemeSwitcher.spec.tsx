import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {
  DEFAULT_QUERY_CLIENT_CONFIG,
  QueryClient,
  QueryClientProvider,
} from 'sentry/utils/queryClient';
// eslint-disable-next-line no-restricted-imports -- @TODO(jonasbadalic): Remove theme import
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {DO_NOT_USE_darkChonkTheme, DO_NOT_USE_lightChonkTheme} from './theme.chonk';
import {useThemeSwitcher} from './useThemeSwitcher';

jest.mock('sentry/utils/removeBodyTheme');

const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG);
const wrapper = ({children}: {children?: React.ReactNode}) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useChonkTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    OrganizationStore.reset();
    ConfigStore.loadInitialData(
      ConfigFixture({
        theme: 'light',
      })
    );
  });

  describe('disabled states', () => {
    it('returns null if no organization is loaded', () => {
      const {result} = renderHook(() => useThemeSwitcher(), {wrapper});
      expect(result.current).toBe(lightTheme);
    });

    it('returns old theme if the organization does not have chonk-ui feature', () => {
      OrganizationStore.onUpdate(
        OrganizationFixture({
          features: [],
        })
      );

      const {result} = renderHook(() => useThemeSwitcher(), {wrapper});
      expect(result.current).toBe(lightTheme);
    });

    it('returns old theme if the user prefers chonk theme, but the organization does not have chonk-ui feature', () => {
      OrganizationStore.onUpdate(
        OrganizationFixture({
          features: ['chonk-ui'],
        })
      );

      const {result} = renderHook(() => useThemeSwitcher(), {wrapper});
      expect(result.current).toBe(lightTheme);
    });

    it('returns old dark theme if the user prefers chonk theme, but the organization does not have chonk-ui feature', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({
            options: {...UserFixture().options, prefersChonkUI: true, theme: 'dark'},
          }),
        })
      );

      OrganizationStore.onUpdate(
        OrganizationFixture({
          features: [],
        })
      );

      const {result} = renderHook(() => useThemeSwitcher(), {wrapper});
      expect(result.current).toBe(darkTheme);
    });
  });

  describe('enabled states', () => {
    it('returns light chonk theme if the organization has chonk-ui feature and user prefers chonk theme', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({
            options: {...UserFixture().options, prefersChonkUI: true, theme: 'system'},
          }),
        })
      );
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui']}));

      const {result} = renderHook(() => useThemeSwitcher(), {wrapper});
      expect(result.current).toBe(DO_NOT_USE_lightChonkTheme);
    });

    it('returns dark chonk theme if the organization has chonk-ui feature and user prefers chonk theme', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({
            options: {...UserFixture().options, prefersChonkUI: true, theme: 'dark'},
          }),
        })
      );
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui']}));

      const {result} = renderHook(() => useThemeSwitcher(), {wrapper});
      expect(result.current).toBe(DO_NOT_USE_darkChonkTheme);
    });
  });
});
