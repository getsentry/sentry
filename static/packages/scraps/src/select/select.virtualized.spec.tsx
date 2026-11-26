import {fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {ThemeWrapper} from '../../test/selectFixtures';

import {Select} from './select';

it('keeps the longest option mounted while a virtualized menu scrolls', async () => {
  // jsdom needs a viewport and row heights to calculate the virtual window.
  const height = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get');
  height.mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('role') === 'listbox' ? 160 : 32;
  });

  try {
    const longestLabel = 'The longest option in the second group';
    render(
      <Select
        aria-label="Choices"
        options={[
          {
            label: 'First group',
            options: Array.from({length: 100}, (_, index) => ({
              value: String(index),
              label: `Option ${index}`,
            })),
          },
          {label: 'Second group', options: [{value: 'longest', label: longestLabel}]},
        ]}
        value={null}
        onChange={() => {}}
        virtualized
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('combobox', {name: 'Choices'}));
    const listbox = screen.getByRole('listbox');
    const items = within(listbox);
    expect(items.getByRole('option', {name: longestLabel})).toBeInTheDocument();
    expect(items.queryByRole('option', {name: 'Option 50'})).not.toBeInTheDocument();

    fireEvent.scroll(listbox, {target: {scrollTop: 1_650}});

    expect(await items.findByRole('option', {name: 'Option 50'})).toBeInTheDocument();
    expect(items.getByRole('option', {name: longestLabel})).toBeInTheDocument();
  } finally {
    height.mockRestore();
  }
});
