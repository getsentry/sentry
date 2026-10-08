import type {ComponentProps} from 'react';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';
import {ReplayRequestFrameFixture} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {hydrateSpans} from 'sentry/utils/replays/hydrateSpans';

import {NetworkTableRow} from './networkTableRow';

function NetworkTableRowInTable(props: ComponentProps<typeof NetworkTableRow>) {
  return (
    <SimpleTable customSections>
      <SimpleTable.Body>
        <NetworkTableRow {...props} />
      </SimpleTable.Body>
    </SimpleTable>
  );
}

describe('NetworkTableRow', () => {
  it('uses parent selection without registering a history listener for every row', async () => {
    const record = ReplayRecordFixture();
    const [frame] = hydrateSpans(record, [
      ReplayRequestFrameFixture({
        startTimestamp: record.started_at,
        endTimestamp: new Date(record.started_at.getTime() + 100),
      }),
    ]);
    const onClickRow = jest.fn();
    const addEventListener = jest.spyOn(window, 'addEventListener');
    try {
      const props = {
        className: '',
        dataIndex: 0,
        frame: frame!,
        onClickRow,
        onClickTimestamp: () => {},
        onMouseEnter: () => {},
        onMouseLeave: () => {},
        startTimestampMs: 0,
      };
      const {rerender} = render(<NetworkTableRowInTable {...props} isSelected />, {
        additionalWrapper: NuqsAdapter,
      });

      expect(
        addEventListener.mock.calls.filter(([name]) => String(name) === 'popstate')
      ).toHaveLength(0);
      // Test setup omits Emotion styles from getComputedStyle; selection still
      // changes the generated class without a separate URL subscription.
      const selectedClassName = screen.getByRole('row').className;
      await userEvent.click(screen.getByText('GET'));
      expect(onClickRow).toHaveBeenCalledWith({dataIndex: 0, rowIndex: 1});

      rerender(<NetworkTableRowInTable {...props} isSelected={false} />);
      expect(screen.getByRole('row')).not.toHaveClass(selectedClassName, {exact: true});
    } finally {
      addEventListener.mockRestore();
    }
  });
});
