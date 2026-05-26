import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  type RenderOptions,
} from 'sentry-test/reactTestingLibrary';

import {PinnedLogs} from 'sentry/views/explore/logs/pinning/PinnedLogs';
import {useLogsPinning} from 'sentry/views/explore/logs/pinning/useLogsPinning';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import type {LogTableRowItem} from 'sentry/views/explore/logs/utils';

const allRows: LogTableRowItem[] = [
  LogFixture({
    [OurLogKnownFieldKey.ID]: 'log-1',
    [OurLogKnownFieldKey.PROJECT_ID]: '1',
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
    [OurLogKnownFieldKey.MESSAGE]: 'first pinned log',
  }),
  LogFixture({
    [OurLogKnownFieldKey.ID]: 'log-2',
    [OurLogKnownFieldKey.PROJECT_ID]: '1',
    [OurLogKnownFieldKey.ORGANIZATION_ID]: 1,
    [OurLogKnownFieldKey.MESSAGE]: 'second pinned log',
  }),
];

const renderRow = (dataRow: LogTableRowItem) => (
  <tr data-test-id={`pinned-row-${dataRow[OurLogKnownFieldKey.ID]}`}>
    <td>{dataRow[OurLogKnownFieldKey.MESSAGE]}</td>
  </tr>
);

function PinnedLogsWrapper() {
  const logsPinning = useLogsPinning()!;

  return (
    <table>
      <PinnedLogs allRows={allRows} logsPinning={logsPinning} renderRow={renderRow} />
    </table>
  );
}

function renderPinnedLogs(options: RenderOptions = {}) {
  return render(<PinnedLogsWrapper />, {
    organization: OrganizationFixture({features: ['ourlogs-pinning']}),
    ...options,
  });
}

describe('PinnedLogs', () => {
  it('renders nothing when no rows are pinned', () => {
    renderPinnedLogs();

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('renders the pinned row when its id is present in allRows', () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    expect(screen.getByTestId('pinned-row-log-1')).toBeInTheDocument();
  });

  it('does not render a row when the pinned id is missing from allRows', () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'missing-log'}},
      },
    });

    expect(screen.queryByTestId('pinned-row-missing-log')).not.toBeInTheDocument();
  });

  it('shows the count of pinned rows in the collapse toggle label', () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1,log-2'}},
      },
    });

    expect(screen.getByRole('button', {name: 'Collapse 2 pinned'})).toBeInTheDocument();
  });

  it('hides the rendered pinned rows when the collapse button is clicked', async () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Collapse 1 pinned'}));

    expect(screen.queryByTestId('pinned-row-log-1')).not.toBeInTheDocument();
  });

  it('shows the rendered pinned rows again when the toggle button is clicked twice', async () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Collapse 1 pinned'}));
    await userEvent.click(screen.getByRole('button', {name: 'Expand 1 pinned'}));

    expect(screen.getByTestId('pinned-row-log-1')).toBeInTheDocument();
  });

  it('removes the rendered pinned rows when the Clear all button is clicked', async () => {
    renderPinnedLogs({
      initialRouterConfig: {
        location: {pathname: '/', query: {logsPinned: 'log-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Clear all pins'}));

    expect(screen.queryByTestId('pinned-row-log-1')).not.toBeInTheDocument();
  });
});
