import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Panel, PanelBody} from 'sentry/components/panels';

type Props = {
  children: React.ReactNode;
};

const EmptyState = ({children}: Props) => (
  <Panel>
    <PanelBody>
      <EmptyStateWarning>
        <p>{children}</p>
      </EmptyStateWarning>
    </PanelBody>
  </Panel>
);

export default EmptyState;
