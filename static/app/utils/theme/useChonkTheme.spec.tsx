import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';

import {DO_NOT_USE_darkChonkTheme, DO_NOT_USE_lightChonkTheme} from './theme.chonk';
import {useChonkTheme} from './useChonkTheme';

jest.mock('sentry/utils/removeBodyTheme');

describe('useChonkTheme', () => {
  beforeEach(() => {
    sessionStorage.clear();
    OrganizationStore.reset();
  });

  it('returns null if no organizationis loaded', () => {
    const {result} = renderHook(() => useChonkTheme());
    expect(result.current[0]).toBeNull();
  });

  it('returns null if the organization does not have chonk-ui feature', () => {
    OrganizationStore.onUpdate(
      OrganizationFixture({
        features: [],
      })
    );

    const {result} = renderHook(() => useChonkTheme());
    expect(result.current[0]).toBeNull();
  });

  it('returns null if organization has chonk-ui feature and session storage is unset', () => {
    sessionStorage.clear();
    OrganizationStore.onUpdate(
      OrganizationFixture({
        features: ['chonk-ui'],
      })
    );

    const {result} = renderHook(() => useChonkTheme());
    expect(result.current[0]).toBeNull();
  });

  it('returns light theme if organization has chonk-ui feature and session storage is set to light', () => {
    sessionStorage.setItem('chonk-theme', JSON.stringify({theme: 'light'}));
    OrganizationStore.onUpdate(
      OrganizationFixture({
        features: ['chonk-ui'],
      })
    );

    const {result} = renderHook(() => useChonkTheme());
    expect(result.current[0]).toBe(DO_NOT_USE_lightChonkTheme);
  });

  it('returns dark theme if organization has chonk-ui feature and dark theme is selected', () => {
    sessionStorage.setItem('chonk-theme', JSON.stringify({theme: 'dark'}));
    OrganizationStore.onUpdate(
      OrganizationFixture({
        features: ['chonk-ui'],
      })
    );

    const {result} = renderHook(() => useChonkTheme());
    expect(result.current[0]).toBe(DO_NOT_USE_darkChonkTheme);
  });

  it('unsets chonk theme on config store theme change', async () => {
    sessionStorage.setItem('chonk-theme', JSON.stringify({theme: 'dark'}));
    OrganizationStore.onUpdate(
      OrganizationFixture({
        features: ['chonk-ui'],
      })
    );

    const {result} = renderHook(() => useChonkTheme());

    await waitFor(() => {
      expect(result.current[0]).toBe(DO_NOT_USE_darkChonkTheme);
    });

    act(() => ConfigStore.set('theme', 'dark'));

    expect(result.current[0]).toBeNull();
    expect(removeBodyTheme).toHaveBeenCalled();
  });
});
