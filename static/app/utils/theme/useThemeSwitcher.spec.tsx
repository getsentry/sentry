import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

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
    it('returns light chonk theme if the organization has chonk-ui-enforce feature and user prefers chonk theme', () => {
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui-enforce']}));
      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(DO_NOT_USE_lightChonkTheme);
    });

    it('returns dark chonk theme if the organization has chonk-ui-enforce feature and user prefers chonk theme', () => {
      ConfigStore.loadInitialData(
        ConfigFixture({
          user: UserFixture({
            options: {...UserFixture().options, theme: 'dark'},
          }),
        })
      );
      OrganizationStore.onUpdate(OrganizationFixture({features: ['chonk-ui-enforce']}));
      const {result} = renderHookWithProviders(useThemeSwitcher);
      expect(result.current).toBe(DO_NOT_USE_darkChonkTheme);
    });
  });
});
