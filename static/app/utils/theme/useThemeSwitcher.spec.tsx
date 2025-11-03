import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
// eslint-disable-next-line no-restricted-imports -- @TODO(jonasbadalic): Remove theme import
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {DO_NOT_USE_darkChonkTheme, DO_NOT_USE_lightChonkTheme} from './theme.chonk';
import {useThemeSwitcher} from './useThemeSwitcher';

jest.mock('sentry/utils/removeBodyTheme');

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
      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(lightTheme);
    });

    it('returns old theme if the organization does not have chonk-ui feature', () => {
      OrganizationStore.onUpdate(
        OrganizationFixture({
          features: [],
        })
      );

      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(lightTheme);
    });

    it('returns old theme if the user prefers chonk theme, but the organization does not have chonk-ui feature', () => {
      OrganizationStore.onUpdate(
        OrganizationFixture({
          features: ['chonk-ui'],
        })
      );

      const {result} = renderHookWithProviders(useThemeSwitcher);
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

      const {result} = renderHookWithProviders(useThemeSwitcher);
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

      const {result} = renderHookWithProviders(useThemeSwitcher);
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

      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(DO_NOT_USE_darkChonkTheme);
    });
  });

  describe('enforce states', () => {
    it('does not return chonk theme if user is undefined', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: undefined,
        })
      );
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui']}));
      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(lightTheme);
    });
    it('does not return chonk theme if organization is undefined', () => {
      OrganizationStore.onUpdate(OrganizationFixture({features: []}));
      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(lightTheme);
    });
    it('does not return chonk theme if user and organization is undefined', () => {
      OrganizationStore.reset();
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: undefined,
        })
      );
      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(lightTheme);
    });
    it('returns chonk theme if the organization has chonk-ui-enforce feature and user has not indicated a preference', async () => {
      const optionsSpy = MockApiClient.addMockResponse({
        url: '/users/me/',
        method: 'PUT',
      });

      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({
            options: {...UserFixture().options, theme: 'light'},
          }),
        })
      );
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui-enforce']}));
      const {result} = renderHookWithProviders(useThemeSwitcher);

      // A user with no preference will get opted into chonk-ui
      await waitFor(() => {
        expect(optionsSpy).toHaveBeenCalledWith(
          '/users/me/',
          expect.objectContaining({
            method: 'PUT',
            data: expect.objectContaining({
              options: expect.objectContaining({
                prefersChonkUI: true,
              }),
            }),
          })
        );
      });
      expect(result.current).toBe(DO_NOT_USE_lightChonkTheme);
    });

    it('returnso old theme if the organization has chonk-ui-enforce feature and user has opted out', () => {
      const optionsSpy = MockApiClient.addMockResponse({
        url: '/users/me/',
        method: 'PUT',
      });

      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({
            options: {...UserFixture().options, prefersChonkUI: false, theme: 'light'},
          }),
        })
      );
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui-enforce']}));
      const {result} = renderHookWithProviders(useThemeSwitcher);

      expect(result.current).toBe(lightTheme);
      // This will fail with act warning if the option is mutated
      expect(optionsSpy).not.toHaveBeenCalled();
    });

    it('returns old theme if the organization has chonk-ui-enforce feature and user has opted out', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({
            options: {...UserFixture().options, prefersChonkUI: false, theme: 'light'},
          }),
        })
      );
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui-enforce']}));
      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(lightTheme);
    });

    it.each(['light', 'dark', 'system'] as const)(
      'opt-out is respected for opted out users',
      theme => {
        ConfigStore.loadInitialData(
          ConfigFixture({
            user: UserFixture({
              options: {...UserFixture().options, prefersChonkUI: false, theme},
            }),
          })
        );
        OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui-enforce']}));
        const {result} = renderHookWithProviders(useThemeSwitcher);
        expect(result.current).toBe(
          theme === 'light' || theme === 'system' ? lightTheme : darkTheme
        );
      }
    );

    it.each(['light', 'dark', 'system'] as const)(
      'opt-out is respected for opted out users',
      theme => {
        ConfigStore.loadInitialData(
          ConfigFixture({
            user: UserFixture({
              options: {...UserFixture().options, prefersChonkUI: false, theme},
            }),
          })
        );
        OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui']}));
        const {result} = renderHookWithProviders(useThemeSwitcher);
        expect(result.current).toBe(
          theme === 'light' || theme === 'system' ? lightTheme : darkTheme
        );
      }
    );
  });
});
