import ConfigStore from 'sentry/stores/configStore';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
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
function DemoModeGate({children, demoComponent}: Props) {
  const organization = useOrganization({allowNull: true});

  if (organization?.orgRole === 'member' && ConfigStore.get('demoMode')) {
    if (typeof demoComponent === 'function') {
      return demoComponent({children});
    }
    return demoComponent ?? null;
  }
  return children;
}

export default DemoModeGate;
