import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Config} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedConfigProps = {
  config: Config;
};

/**
 * Higher order component that passes the config object to the wrapped
 * component
 */
function withConfig<P extends InjectedConfigProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedConfigProps> & Partial<InjectedConfigProps>;

  function Wrapper(props: Props) {
    const config = useLegacyStore(ConfigStore);
    const allProps = {config, ...props} as P;

    return <WrappedComponent {...allProps} />;
  }

  Wrapper.displayName = `withConfig(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withConfig;
