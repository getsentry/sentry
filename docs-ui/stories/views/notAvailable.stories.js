import NotAvailable from 'sentry/components/notAvailable';
import PanelTable from 'sentry/components/panels/panelTable';

export default {
  title: 'Views/Not Available',
  component: NotAvailable,
};

export const Default = () => (
  <div>
    <div className="section">
      <h3>Alone</h3>
      <NotAvailable />
    </div>
    <div className="section">
      <h3>In a Table</h3>
      <PanelTable headers={['Header #1', 'Header #2']}>
        <div>Panel Item with really long content</div>
        <div>
          <NotAvailable />
        </div>
      </PanelTable>
    </div>
    <div className="section">
      <h3>With Tooltip</h3>
      <NotAvailable tooltip="Reason why this is not available" />
    </div>
  </div>
);

Default.storyName = 'Not Available';
Default.parameters = {
  docs: {
    description: {
      story:
        "When you don't have data to display, but don't want to display an empty space. It's commonly used in a table.",
    },
  },
};
