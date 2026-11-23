import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {User} from 'sentry/types/user';

import {ThemeAndStyleProvider} from './themeAndStyleProvider';

function userWithTheme(theme: 'light' | 'dark' | 'system') {
  const user = UserFixture();
  return {...user, options: {...user.options, theme}};
}

describe('ThemeAndStyleProvider', () => {
  afterEach(() => {
    delete document.documentElement.dataset.colorScheme;
    delete document.documentElement.dataset.themeDark;
  });

  it('sets data-color-scheme on <html> to the unresolved user setting', () => {
    ConfigStore.set('user', userWithTheme('system'));
    ConfigStore.set('theme', 'dark');

    render(<ThemeAndStyleProvider>content</ThemeAndStyleProvider>);

    expect(document.documentElement).toHaveAttribute('data-color-scheme', 'system');
  });

  it('updates data-color-scheme when the user setting changes', () => {
    ConfigStore.set('user', userWithTheme('light'));

    render(<ThemeAndStyleProvider>content</ThemeAndStyleProvider>);
    expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light');

    act(() => ConfigStore.set('user', userWithTheme('dark')));
    expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark');
  });

  it('defaults to system without a user', () => {
    // @ts-expect-error logged-out pages have no user
    ConfigStore.set('user', null);

    render(<ThemeAndStyleProvider>content</ThemeAndStyleProvider>);

    expect(document.documentElement).toHaveAttribute('data-color-scheme', 'system');
  });

  describe('data-theme-dark', () => {
    beforeEach(() => {
      OrganizationStore.reset();
    });

    function userWithDarkTheme(themeVariantDark: User['options']['themeVariantDark']) {
      const user = UserFixture();
      return {...user, options: {...user.options, themeVariantDark}};
    }

    it('sets the saved dark theme with theme-variants', () => {
      OrganizationStore.onUpdate(OrganizationFixture({features: ['theme-variants']}));
      ConfigStore.set('user', userWithDarkTheme('midnight'));

      render(<ThemeAndStyleProvider>content</ThemeAndStyleProvider>);

      expect(document.documentElement).toHaveAttribute('data-theme-dark', 'midnight');
    });

    it('removes the attribute when the dark theme goes back to default', () => {
      OrganizationStore.onUpdate(OrganizationFixture({features: ['theme-variants']}));
      ConfigStore.set('user', userWithDarkTheme('ash'));

      render(<ThemeAndStyleProvider>content</ThemeAndStyleProvider>);
      expect(document.documentElement).toHaveAttribute('data-theme-dark', 'ash');

      act(() => ConfigStore.set('user', userWithDarkTheme('default')));
      expect(document.documentElement).not.toHaveAttribute('data-theme-dark');
    });

    it('does not set the attribute without theme-variants', () => {
      OrganizationStore.onUpdate(OrganizationFixture({features: []}));
      ConfigStore.set('user', userWithDarkTheme('ash'));

      render(<ThemeAndStyleProvider>content</ThemeAndStyleProvider>);

      expect(document.documentElement).not.toHaveAttribute('data-theme-dark');
    });
  });
});
