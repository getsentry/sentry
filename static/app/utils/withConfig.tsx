import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Config} from 'sentry/types/system';
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

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...(allProps as any)} />;
  }

  Wrapper.displayName = `withConfig(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withConfig;
