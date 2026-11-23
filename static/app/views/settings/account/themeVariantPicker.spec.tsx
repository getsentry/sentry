import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ThemeVariantPicker} from './themeVariantPicker';

function getPreview(radio: HTMLElement) {
  // The preview sits inside the radio's label, next to the native input.
  return within(radio.parentElement!).getByTestId('theme-preview');
}

describe('ThemeVariantPicker', () => {
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
});
