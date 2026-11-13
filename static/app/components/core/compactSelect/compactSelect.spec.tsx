import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

describe('CompactSelect app integration', () => {
  it.each([
    {search: true, usePortal: true},
    {search: false, usePortal: true},
    {search: true, usePortal: false},
    {search: false, usePortal: false},
  ])(
    'preserves nested menu focus when opening autofocus runs (search=$search, portal=$usePortal)',
    async ({search, usePortal}) => {
      const onAction = jest.fn();
      render(
        <CompactSelect
          search={search}
          value="opt_one"
          onChange={jest.fn()}
          options={[{value: 'opt_one', label: 'Option One'}]}
          menuTitle={
            <DropdownMenu
              usePortal={usePortal}
              triggerLabel="Operator"
              items={[{key: 'is', label: 'is', onAction}]}
            />
          }
        />
      );

      const openingFrames: FrameRequestCallback[] = [];
      const frameMock = jest
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation(callback => {
          openingFrames.push(callback);
          return 0;
        });

      try {
        await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
        frameMock.mockRestore();
        await userEvent.click(screen.getByRole('button', {name: 'Operator'}));
        const menuItem = screen.getByRole('menuitemradio', {name: 'is'});
        expect(menuItem).toHaveFocus();

        act(() => {
          openingFrames.forEach(callback => callback(0));
        });

        expect(menuItem).toHaveFocus();
        await userEvent.keyboard('{Enter}');
        expect(onAction).toHaveBeenCalledTimes(1);
      } finally {
        frameMock.mockRestore();
      }
    }
  );
});
