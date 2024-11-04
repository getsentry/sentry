import {isDemoModeEnabled} from 'sentry/utils/demoMode';

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
  if (!isDemoModeEnabled()) {
    return children;
  }
  if (typeof demoComponent === 'function') {
    return demoComponent({children});
  }
  return demoComponent ?? null;
}

export default DemoModeGate;
