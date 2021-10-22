import * as React from 'react';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel, PanelBody} from 'app/components/panels';

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
