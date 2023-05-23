import {DataRow} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import QueryDetail from 'sentry/views/starfish/modules/databaseModule/panel';
import {SpanDataRow} from 'sentry/views/starfish/views/spans/spansTable';
import {SpanSummaryPanel} from 'sentry/views/starfish/views/spans/spanSummaryPanel';

type SpanDetailBodyProps = {
  row: SpanDataRow;
};
export default function SpanDetail({
  row,
  onClose,
}: Partial<SpanDetailBodyProps> & {onClose: () => void}) {
  // Types need to be fixed here
  switch (row?.span_operation) {
    case 'db':
      return (
        <QueryDetail
          row={row as unknown as DataRow}
          onClose={onClose}
          isDataLoading={false}
          mainTableSort={{
            direction: undefined,
            sortHeader: undefined,
          }}
          onRowChange={() => null}
        />
      );
    default:
      return <SpanSummaryPanel span={row} onClose={onClose} />;
  }
}
