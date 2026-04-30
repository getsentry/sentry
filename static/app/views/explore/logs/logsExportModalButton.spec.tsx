import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import type {LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {LogsExportModalButton} from 'sentry/views/explore/logs/exports/logsExportModalButton';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const mockTrackAnalytics = jest.fn();

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: (...args: unknown[]) => mockTrackAnalytics(...args),
}));

jest.mock('sentry/actionCreators/modal', () => ({
  openModal: jest.fn(),
}));

describe('LogsExportModalButton', () => {
  const organization = OrganizationFixture({features: ['discover-query']});

  const queryInfo: LogsQueryInfo = {
    dataset: 'logs',
    field: [OurLogKnownFieldKey.MESSAGE],
    project: [1],
    query: 'level:error',
    sort: ['-timestamp'],
  };

  const tableData = [
    LogFixture({
      id: 'log-1',
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function clickExportDataAndGetOnClose() {
    render(
      <LogsExportModalButton
        error={null}
        isLoading={false}
        queryInfo={queryInfo}
        tableData={tableData}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));

    expect(openModal).toHaveBeenCalled();
    const openOptions = (openModal as jest.Mock).mock.calls[0]?.[1];
    expect(openOptions?.onClose).toEqual(expect.any(Function));

    return openOptions.onClose;
  }

  it('tracks cancel analytics when onClose receives escape-key', async () => {
    const onClose = await clickExportDataAndGetOnClose();

    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'logs.export_modal',
      expect.objectContaining({
        action: 'open',
      })
    );

    onClose('escape-key');
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'logs.export_modal',
      expect.objectContaining({
        action: 'cancel',
        close_reason: 'escape_key',
      })
    );
  });

  it('does not track cancel analytics when onClose receives undefined reason', async () => {
    const onClose = await clickExportDataAndGetOnClose();

    expect(mockTrackAnalytics).toHaveBeenCalledTimes(1);
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'logs.export_modal',
      expect.objectContaining({
        action: 'open',
      })
    );

    onClose(undefined);

    expect(mockTrackAnalytics).toHaveBeenCalledTimes(1);
  });
});
