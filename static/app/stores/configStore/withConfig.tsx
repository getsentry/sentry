import {useConfig} from 'sentry/stores/configStore/useConfig';
import {Config} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

interface WithConfigProps {
  config: Config;
}

export function withConfig<P extends WithConfigProps>(
  WrappedComponent: React.ComponentType<P>
) {
  const Wrapper: React.FC<Omit<P, keyof WithConfigProps>> = props => {
    const [config] = useConfig();
    return <WrappedComponent {...(props as unknown as P)} config={config} />;
  };

  Wrapper.displayName = `withConfig(${getDisplayName(WrappedComponent)})`;
  return Wrapper;
}
