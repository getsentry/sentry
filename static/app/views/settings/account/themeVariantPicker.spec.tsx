import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import type {User} from 'sentry/types/user';

import {ThemeVariantPicker} from './themeVariantPicker';

function userWithVariants(options: Partial<User['options']> = {}) {
  const user = UserFixture();
  return {...user, options: {...user.options, ...options}};
}

function getPreview(radio: HTMLElement) {
  // The preview sits inside the radio's label, next to the native input.
  return within(radio.parentElement!).getByTestId('theme-preview');
}

describe('ThemeVariantPicker', () => {
  let mockUserUpdate: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ConfigStore.set('user', userWithVariants());
    mockUserUpdate = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'PUT',
      body: userWithVariants({themeVariantDark: 'ash'}),
    });
  });

  it('renders a Light and a Dark radio group', () => {
    render(<ThemeVariantPicker />);

    const light = screen.getByRole('radiogroup', {name: 'Light'});
    const dark = screen.getByRole('radiogroup', {name: 'Dark'});

    expect(
      within(light)
        .getAllByRole('radio')
        .map(radio => radio.getAttribute('value'))
    ).toEqual(['default']);
    expect(
      within(dark)
        .getAllByRole('radio')
        .map(radio => radio.getAttribute('value'))
    ).toEqual(['default', 'ash', 'midnight']);
    expect(within(light).getByRole('radio', {name: 'Default'})).toBeChecked();
    expect(within(dark).getByRole('radio', {name: 'Default'})).toBeChecked();
  });

  it('selects one dark theme at a time without changing the light theme', async () => {
    render(<ThemeVariantPicker />);

    const light = screen.getByRole('radiogroup', {name: 'Light'});
    const dark = screen.getByRole('radiogroup', {name: 'Dark'});

    await userEvent.click(within(dark).getByText('Ash'));
    expect(within(dark).getByRole('radio', {name: 'Ash'})).toBeChecked();
    expect(within(dark).getByRole('radio', {name: 'Default'})).not.toBeChecked();
    expect(within(light).getByRole('radio', {name: 'Default'})).toBeChecked();

    await userEvent.keyboard('{ArrowRight}');
    expect(within(dark).getByRole('radio', {name: 'Midnight'})).toBeChecked();
    expect(within(dark).getByRole('radio', {name: 'Midnight'})).toHaveFocus();
    expect(within(dark).getByRole('radio', {name: 'Ash'})).not.toBeChecked();
  });

  it('scopes each preview to its color scheme and theme', () => {
    render(<ThemeVariantPicker />);

    const light = screen.getByRole('radiogroup', {name: 'Light'});
    const lightPreview = getPreview(within(light).getByRole('radio', {name: 'Default'}));
    expect(lightPreview).toHaveAttribute('data-color-scheme', 'light');
    expect(lightPreview).not.toHaveAttribute('data-theme-dark');

    const dark = screen.getByRole('radiogroup', {name: 'Dark'});
    for (const [name, value] of [
      ['Default', 'default'],
      ['Ash', 'ash'],
      ['Midnight', 'midnight'],
    ]) {
      const preview = getPreview(within(dark).getByRole('radio', {name}));
      expect(preview).toHaveAttribute('data-color-scheme', 'dark');
      expect(preview).toHaveAttribute('data-theme-dark', value);
      expect(preview).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('shows the saved theme for each scheme', () => {
    ConfigStore.set('user', userWithVariants({themeVariantDark: 'midnight'}));

    render(<ThemeVariantPicker />);

    const dark = screen.getByRole('radiogroup', {name: 'Dark'});
    expect(within(dark).getByRole('radio', {name: 'Midnight'})).toBeChecked();
    const light = screen.getByRole('radiogroup', {name: 'Light'});
    expect(within(light).getByRole('radio', {name: 'Default'})).toBeChecked();
  });

  it('saves the dark theme as a user option', async () => {
    render(<ThemeVariantPicker />);

    const dark = screen.getByRole('radiogroup', {name: 'Dark'});
    await userEvent.click(within(dark).getByText('Ash'));

    await waitFor(() =>
      expect(ConfigStore.get('user').options.themeVariantDark).toBe('ash')
    );
    expect(mockUserUpdate).toHaveBeenCalledWith(
      '/users/me/',
      expect.objectContaining({data: {options: {themeVariantDark: 'ash'}}})
    );
  });

  it('does not save the light theme', async () => {
    render(<ThemeVariantPicker />);

    const light = screen.getByRole('radiogroup', {name: 'Light'});
    await userEvent.click(within(light).getByText('Default'));

    expect(within(light).getByRole('radio', {name: 'Default'})).toBeChecked();
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it('goes back to the saved theme when saving fails', async () => {
    MockApiClient.addMockResponse({url: '/users/me/', method: 'PUT', statusCode: 500});

    render(<ThemeVariantPicker />);

    const dark = screen.getByRole('radiogroup', {name: 'Dark'});
    await userEvent.click(within(dark).getByText('Ash'));

    await waitFor(() =>
      expect(within(dark).getByRole('radio', {name: 'Default'})).toBeChecked()
    );
    expect(within(dark).getByRole('radio', {name: 'Ash'})).not.toBeChecked();
  });
});
