import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Panel, PanelBody} from 'sentry/components/panels';

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
