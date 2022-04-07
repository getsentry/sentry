import {Config} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

import {useConfigStore} from './configProvider';

interface WithConfigProps {
  config: Config;
}

export function withConfig<P extends WithConfigProps>(
  WrappedComponent: React.ComponentType<P>
) {
  const Wrapper: React.FC<Omit<P, keyof WithConfigProps>> = props => {
    const config = useConfigStore();
    return <WrappedComponent {...(props as unknown as P)} config={config} />;
  };

  Wrapper.displayName = `withConfig(${getDisplayName(WrappedComponent)})`;
  return Wrapper;
}
