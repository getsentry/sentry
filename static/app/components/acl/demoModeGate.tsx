import * as React from 'react';

import ConfigStore from 'app/stores/configStore';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  /**
   * Current Organization
   */
  organization: Organization;

  /**
   * Children can be a node or a function as child.
   */
  children?: React.ReactNode;

  demoComponent?:
    | React.ReactNode
    | ((props: {children?: React.ReactNode}) => React.ReactNode);
};

/**
 * Component to handle demo mode switches
 */
function DemoModeGate(props: Props) {
  const {organization, children, demoComponent = null} = props;

  if (organization?.role === 'member' && ConfigStore.get('demoMode')) {
    if (typeof demoComponent === 'function') {
      return demoComponent({children});
    }
    return demoComponent;
  }
  return children;
}

export default withOrganization(DemoModeGate);
