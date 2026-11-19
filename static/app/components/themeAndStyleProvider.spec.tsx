import {UserFixture} from 'sentry-fixture/user';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {ThemeAndStyleProvider} from './themeAndStyleProvider';

function userWithTheme(theme: 'light' | 'dark' | 'system') {
  const user = UserFixture();
  return {...user, options: {...user.options, theme}};
}

describe('ThemeAndStyleProvider', () => {
  afterEach(() => {
    delete document.documentElement.dataset.colorScheme;
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
});
