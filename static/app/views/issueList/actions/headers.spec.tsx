import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {IssueDisplayPropertiesProvider} from 'sentry/views/issueList/displayProperties';

import {HeaderContextMenu} from './headerContextMenu';
import {Headers} from './headers';

const onSelectStatsPeriod = jest.fn();
const selection = PageFiltersFixture({
  datetime: {period: '14d', start: null, end: null, utc: null},
});

function Example({reprocessing = false}: {reprocessing?: boolean}) {
  return (
    <IssueDisplayPropertiesProvider>
      {!reprocessing && <HeaderContextMenu hideDivider>Issue</HeaderContextMenu>}
      <Headers
        selection={selection}
        statsPeriod="auto"
        onSelectStatsPeriod={onSelectStatsPeriod}
        isReprocessingQuery={reprocessing}
      />
    </IssueDisplayPropertiesProvider>
  );
}

describe('Issue header context menus', () => {
  beforeEach(() => {
    localStorageWrapper.clear();
    onSelectStatsPeriod.mockClear();
  });

  it('hides columns with right-click and restores them from Issue', async () => {
    render(<Example />);
    await userEvent.pointer({target: screen.getByText('Events'), keys: '[MouseRight]'});
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Hide column'})
    );
    expect(screen.queryByText('Events')).not.toBeInTheDocument();
    await userEvent.pointer({target: screen.getByText('Issue'), keys: '[MouseRight]'});
    expect(
      screen.queryByRole('menuitemradio', {name: 'Hide column'})
    ).not.toBeInTheDocument();
    await userEvent.hover(await screen.findByRole('menuitemradio', {name: 'Columns'}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: /Events.*Hidden/})
    );
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('opens from the keyboard, dismisses, and returns focus', async () => {
    render(<Example />);
    await userEvent.click(screen.getByText('Issue'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(screen.getByText('Issue')).toHaveFocus();
    await userEvent.keyboard('{ContextMenu}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('keeps Trend controls working without opening a menu', async () => {
    render(<Example />);
    await userEvent.click(screen.getByText('24h'));
    expect(onSelectStatsPeriod).toHaveBeenCalledWith('24h');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.pointer({target: screen.getByText('Trend'), keys: '[MouseRight]'});
    expect(
      await screen.findByRole('menuitemradio', {name: 'Hide column'})
    ).toBeInTheDocument();
  });

  it('leaves reprocessing headers unchanged', async () => {
    render(<Example reprocessing />);
    await userEvent.pointer({
      target: screen.getByText('Events Reprocessed'),
      keys: '[MouseRight]',
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
