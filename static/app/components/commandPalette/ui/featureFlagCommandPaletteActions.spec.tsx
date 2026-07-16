import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {CommandPaletteHotkeys} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import {localStorageWrapper} from 'sentry/utils/localStorage';

import {
  FeatureFlagCommandPaletteActions,
  setLocalFeatureFlagOverride,
} from './featureFlagCommandPaletteActions';

const LOCALSTORAGE_KEY = 'feature-flag-overrides';

mockElementSize();

function SlotOutlets() {
  return (
    <div style={{display: 'none'}}>
      <CommandPaletteSlot.Outlet name="task">
        {props => <div {...props} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="page">
        {props => <div {...props} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="global">
        {props => <div {...props} />}
      </CommandPaletteSlot.Outlet>
    </div>
  );
}

function renderFeatureFlagActions(organization = OrganizationFixture()) {
  render(
    <Fragment>
      <CommandPaletteHotkeys />
      <FeatureFlagCommandPaletteActions />
      <SlotOutlets />
      <GlobalModal />
    </Fragment>,
    {organization}
  );
}

async function openCommandPalette() {
  await userEvent.keyboard('{Control>}k{/Control}');
  return screen.findByRole('textbox', {name: 'Search commands'});
}

describe('FeatureFlagCommandPaletteActions', () => {
  beforeEach(() => {
    localStorage.clear();
    OrganizationStore.reset();
  });

  it('persists an override and updates the active organization immediately', () => {
    const organization = OrganizationFixture({features: ['enabled-feature']});

    setLocalFeatureFlagOverride(organization, 'new-feature', true);

    expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe('{"new-feature":true}');
    const updatedFeatures = OrganizationStore.get().organization?.features;
    expect(updatedFeatures).toHaveLength(2);
    expect(updatedFeatures).toContain('enabled-feature');
    expect(updatedFeatures).toContain('new-feature');
    expect(organization.features).toEqual(['enabled-feature']);
  });

  it('toggles an existing feature flag without reloading', async () => {
    const organization = OrganizationFixture({features: ['enabled-feature']});
    renderFeatureFlagActions(organization);

    await openCommandPalette();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search commands'}),
      'Toggle Org Feature Flag'
    );
    await userEvent.click(
      await screen.findByRole('option', {name: /Toggle Org Feature Flag/})
    );
    await userEvent.click(await screen.findByRole('option', {name: /enabled-feature/}));

    expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe(
      '{"enabled-feature":false}'
    );
    expect(OrganizationStore.get().organization?.features).not.toContain(
      'enabled-feature'
    );
  });

  it('keeps a disabled feature flag in the list after returning to it', async () => {
    const organization = OrganizationFixture({features: ['enabled-feature']});
    renderFeatureFlagActions(organization);

    await openCommandPalette();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search commands'}),
      'Toggle Org Feature Flag'
    );
    await userEvent.click(
      await screen.findByRole('option', {name: /Toggle Org Feature Flag/})
    );
    await userEvent.click(await screen.findByRole('option', {name: /enabled-feature/}));

    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', {name: 'Search commands'})
      ).not.toBeInTheDocument()
    );

    await openCommandPalette();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search commands'}),
      'Toggle Org Feature Flag'
    );
    await userEvent.click(
      await screen.findByRole('option', {name: /Toggle Org Feature Flag/})
    );

    const disabledFlag = await screen.findByRole('option', {
      name: 'enabled-feature',
    });
    expect(disabledFlag).toHaveTextContent('Disabled');
  });

  it('adds a new enabled feature flag from the modal', async () => {
    const organization = OrganizationFixture({features: []});
    renderFeatureFlagActions(organization);

    await openCommandPalette();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search commands'}),
      'Add Feature Flag'
    );
    await userEvent.click(await screen.findByRole('option', {name: /Add Feature Flag/}));
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Feature flag name'}),
      'new-feature'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add Feature Flag'}));

    await waitFor(() =>
      expect(OrganizationStore.get().organization?.features).toContain('new-feature')
    );
    expect(localStorageWrapper.getItem(LOCALSTORAGE_KEY)).toBe('{"new-feature":true}');
  });
});
