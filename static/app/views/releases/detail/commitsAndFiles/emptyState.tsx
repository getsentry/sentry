import * as React from 'react';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Panel, PanelBody} from 'sentry/components/panels';

interface Props {
  children: React.ReactNode;
}

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
