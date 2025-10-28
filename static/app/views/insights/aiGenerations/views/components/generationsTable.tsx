import {PanelTable} from 'sentry/components/panels/panelTable';

export function GenerationsTable() {
  return (
    <PanelTable headers={['id', 'input/output', 'model', 'cost', 'timestamp']}>
      <div>1244</div>
      <div>
        <div>User Input</div>
        <div>Some AI response</div>
      </div>
      <div>gpt-4o</div>
      <div>1244$</div>
      <div>2025-01-01 12:00:00</div>
      <div>1245</div>
      <div>
        <div>Another user query</div>
        <div>Short AI answer</div>
      </div>
      <div>gpt-4o</div>
      <div>8$</div>
      <div>2025-01-01 8:00:00</div>
    </PanelTable>
  );
}
