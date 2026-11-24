import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  type SeerSelection,
  SeerSelectionProvider,
  usePublishSeerSelection,
} from 'sentry/views/seerExplorer/contexts/seerSelection';
import * as seerExplorerUtils from 'sentry/views/seerExplorer/utils';

import {SeerSelectionToggle} from './seerSelectionToggle';

function Publisher({selection}: {selection: SeerSelection | null}) {
  usePublishSeerSelection(selection);
  return null;
}

const ONE_ISSUE: SeerSelection = {itemType: 'issue', count: 1, items: [{shortId: 'A-1'}]};
const THREE_ISSUES: SeerSelection = {
  itemType: 'issue',
  count: 3,
  items: [{shortId: 'A-1'}, {shortId: 'A-2'}, {shortId: 'A-3'}],
};
const ONE_REPLAY: SeerSelection = {itemType: 'replay', count: 1, items: [{id: 'r1'}]};
const TWO_REPLAYS: SeerSelection = {
  itemType: 'replay',
  count: 2,
  items: [{id: 'r1'}, {id: 'r2'}],
};
const ONE_MONITOR: SeerSelection = {itemType: 'monitor', count: 1, items: [{id: 'm1'}]};
const FOUR_ALERTS: SeerSelection = {itemType: 'alert', count: 4, items: [{id: 'a1'}]};

describe('SeerSelectionToggle', () => {
  beforeEach(() => {
    jest.spyOn(seerExplorerUtils, 'usePageRouteString').mockReturnValue('/issues/');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing on a page whose page context leaves the selection out', () => {
    jest
      .spyOn(seerExplorerUtils, 'usePageRouteString')
      .mockReturnValue('/settings/account/details/');
    render(
      <SeerSelectionProvider>
        <Publisher selection={THREE_ISSUES} />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing without a selection', () => {
    render(
      <SeerSelectionProvider>
        <Publisher selection={null} />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    [ONE_ISSUE, '1 issue'],
    [THREE_ISSUES, '3 issues'],
    [ONE_REPLAY, '1 replay'],
    [TWO_REPLAYS, '2 replays'],
    [ONE_MONITOR, '1 monitor'],
    [FOUR_ALERTS, '4 alerts'],
  ])('labels the selection with its count and type', async (selection, label) => {
    render(
      <SeerSelectionProvider>
        <Publisher selection={selection} />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    const toggle = await screen.findByRole('button', {
      name: `Include ${label} in context`,
    });
    expect(toggle).toHaveTextContent(label);
  });

  it('switches to a neutral tag without an icon when turned off, and back', async () => {
    render(
      <SeerSelectionProvider>
        <Publisher selection={THREE_ISSUES} />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    const toggle = await screen.findByRole('button', {
      name: 'Include 3 issues in context',
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle.querySelector('svg')).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle.querySelector('svg')).not.toBeInTheDocument();
    expect(toggle).toHaveTextContent('3 issues');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle.querySelector('svg')).toBeInTheDocument();
  });

  it('turns on again for the next selection', async () => {
    const {rerender} = render(
      <SeerSelectionProvider>
        <Publisher selection={THREE_ISSUES} />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    await userEvent.click(
      await screen.findByRole('button', {name: 'Include 3 issues in context'})
    );

    rerender(
      <SeerSelectionProvider>
        <Publisher selection={null} />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <SeerSelectionProvider>
        <Publisher selection={ONE_ISSUE} />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );
    expect(
      await screen.findByRole('button', {name: 'Include 1 issue in context'})
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
