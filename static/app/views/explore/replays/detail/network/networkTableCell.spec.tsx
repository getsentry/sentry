import type {ReactNode} from 'react';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';
import {ReplayRequestFrameFixture} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {hydrateSpans} from 'sentry/utils/replays/hydrateSpans';
import type {RawSpanFrame} from 'sentry/utils/replays/types';

import {NetworkTableCell} from './networkTableCell';

function TableWrapper({children}: {children: ReactNode}) {
  return (
    <NuqsAdapter>
      <SimpleTable>
        <SimpleTable.Row>{children}</SimpleTable.Row>
      </SimpleTable>
    </NuqsAdapter>
  );
}

describe('NetworkTableCell', () => {
  it('uses parent selection without registering a history listener for every cell', async () => {
    const record = ReplayRecordFixture();
    const [frame] = hydrateSpans(record, [
      ReplayRequestFrameFixture({
        startTimestamp: record.started_at,
        endTimestamp: new Date(record.started_at.getTime() + 100),
      }),
    ]);
    const onClickCell = jest.fn();
    const addEventListener = jest.spyOn(window, 'addEventListener');
    try {
      const {rerender} = render(
        <NetworkTableCell
          columnIndex={0}
          frame={frame!}
          isSelected
          onClickCell={onClickCell}
          onClickTimestamp={() => {}}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          rowIndex={1}
          startTimestampMs={0}
          style={{}}
        />,
        {additionalWrapper: TableWrapper}
      );

      expect(
        addEventListener.mock.calls.filter(([name]) => String(name) === 'popstate')
      ).toHaveLength(0);
      // Test setup omits Emotion styles from getComputedStyle; selection still
      // changes the generated class without a separate URL subscription.
      const selectedClassName = screen.getByText('GET').parentElement!.className;
      await userEvent.click(screen.getByText('GET'));
      expect(onClickCell).toHaveBeenCalledWith({dataIndex: 0, rowIndex: 1});

      rerender(
        <NetworkTableCell
          columnIndex={0}
          frame={frame!}
          isSelected={false}
          onClickCell={onClickCell}
          onClickTimestamp={() => {}}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          rowIndex={1}
          startTimestampMs={0}
          style={{}}
        />
      );
      expect(screen.getByText('GET').parentElement!.className).not.toBe(
        selectedClassName
      );
    } finally {
      addEventListener.mockRestore();
    }
  });

  it.each(['resource.script', 'resource.fetch'] as const)(
    'renders an empty size cell when a %s frame has no data',
    op => {
      const record = ReplayRecordFixture();
      const [frame] = hydrateSpans(record, [
        {
          op,
          description: 'https://example.com/asset',
          startTimestamp: record.started_at.getTime() / 1000,
          endTimestamp: (record.started_at.getTime() + 100) / 1000,
        } as RawSpanFrame,
      ]);

      render(
        <NetworkTableCell
          columnIndex={4}
          frame={frame!}
          isSelected={false}
          onClickCell={() => {}}
          onClickTimestamp={() => {}}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          rowIndex={1}
          startTimestampMs={0}
          style={{}}
        />,
        {additionalWrapper: NuqsAdapter}
      );

      expect(screen.getByText('--')).toBeInTheDocument();
    }
  );
});
