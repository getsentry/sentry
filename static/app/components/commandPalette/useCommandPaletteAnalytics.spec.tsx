import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  closeModal,
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {trackAnalytics} from 'sentry/utils/analytics';

import {CMDKAction, CommandPaletteProvider} from './ui/cmdk';
import {CommandPalette} from './ui/commandPalette';

jest.mock('sentry/utils/analytics');

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({count}: {count: number}) => {
    const virtualItems = Array.from({length: count}, (_, index) => ({
      key: index,
      index,
      start: index * 48,
      size: 48,
      lane: 0,
    }));
    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => count * 48,
      measureElement: jest.fn(),
      measure: jest.fn(),
      scrollToIndex: jest.fn(),
    };
  },
}));

function Palette() {
  return (
    <CommandPaletteProvider>
      <Fragment>
        <CMDKAction to="/settings/org-slug/members/" display={{label: 'Members'}} />
        <CMDKAction
          to="/settings/org-slug/projects/project-slug/filters/"
          display={{label: 'Inbound Filters'}}
        />
        <CMDKAction
          to="/settings/account/details/"
          display={{label: 'Account Details'}}
        />
        <CMDKAction
          to={{pathname: '/settings/org-slug/', hash: '#name'}}
          display={{label: 'Organization Name'}}
        />
        <CMDKAction to="/organizations/org-slug/issues/" display={{label: 'Issues'}} />
      </Fragment>
      <CommandPalette
        closeModal={closeModal}
        Body={ModalBody}
        Footer={ModalFooter}
        Header={makeClosableHeader(closeModal)}
        CloseButton={makeCloseButton(closeModal)}
      />
    </CommandPaletteProvider>
  );
}

function entryPointCalls() {
  return jest
    .mocked(trackAnalytics)
    .mock.calls.filter(([eventKey]) => eventKey === 'settings.entry_point_clicked');
}

describe('useCommandPaletteAnalytics settings entry point', () => {
  beforeEach(() => {
    jest.mocked(trackAnalytics).mockClear();
  });

  it.each([
    ['Members', 'org'],
    ['Inbound Filters', 'project'],
    ['Account Details', 'account'],
    ['Organization Name', 'org'],
  ])(
    'tracks a settings entry when %s is picked outside of settings',
    async (label, scope) => {
      render(<Palette />, {
        initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
      });

      await userEvent.click(await screen.findByRole('option', {name: label}));

      expect(entryPointCalls()).toEqual([
        [
          'settings.entry_point_clicked',
          expect.objectContaining({entry_point: 'command_palette', scope}),
        ],
      ]);
    }
  );

  it('does not track a settings entry when moving between settings pages', async () => {
    render(<Palette />, {
      initialRouterConfig: {location: {pathname: '/settings/org-slug/projects/'}},
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Inbound Filters'}));

    expect(entryPointCalls()).toEqual([]);
  });

  it('does not track a settings entry for pages outside of settings', async () => {
    render(<Palette />, {
      initialRouterConfig: {location: {pathname: '/organizations/org-slug/projects/'}},
    });

    await userEvent.click(await screen.findByRole('option', {name: 'Issues'}));

    expect(entryPointCalls()).toEqual([]);
  });
});
