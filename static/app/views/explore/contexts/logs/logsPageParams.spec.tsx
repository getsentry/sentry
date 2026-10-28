import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {
  PersistedLogsPageParamsProvider,
  usePersistedLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';

function ColumnsEditor() {
  const [params, setParams] = usePersistedLogsPageParams();
  return (
    <button onClick={() => setParams(prev => ({...prev, fields: ['message']}))}>
      Columns: {params.fields.join(', ')}
    </button>
  );
}

function SortEditor() {
  const [params, setParams] = usePersistedLogsPageParams();
  return (
    <button onClick={() => setParams(prev => ({...prev, sortBys: []}))}>
      Sorts: {params.sortBys.map(sort => sort.field).join(', ')}
    </button>
  );
}

it('shares persisted preferences between consumers and preserves functional updates', async () => {
  localStorageWrapper.setItem(
    'logs-params-v2',
    JSON.stringify({
      fields: ['timestamp', 'message'],
      sortBys: [{field: 'timestamp', kind: 'asc'}],
    })
  );

  render(
    <PersistedLogsPageParamsProvider>
      <ColumnsEditor />
      <SortEditor />
    </PersistedLogsPageParamsProvider>
  );

  await userEvent.click(
    screen.getByRole('button', {name: 'Columns: timestamp, message'})
  );
  await userEvent.click(screen.getByRole('button', {name: 'Sorts: timestamp'}));

  expect(screen.getByRole('button', {name: 'Columns: message'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Sorts:'})).toBeInTheDocument();
  await waitFor(() => {
    expect(JSON.parse(localStorageWrapper.getItem('logs-params-v2')!)).toEqual({
      fields: ['message'],
      sortBys: [],
    });
  });
});
