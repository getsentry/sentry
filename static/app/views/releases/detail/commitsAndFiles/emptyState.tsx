import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';

type Props = {
  children: React.ReactNode;
};

function EmptyState({children}: Props) {
  return (
    <Panel>
      <PanelBody>
        <EmptyStateWarning>
          <p>{children}</p>
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );
}

export default EmptyState;
