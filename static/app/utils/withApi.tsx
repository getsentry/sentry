import type {Client} from 'sentry/api';
import getDisplayName from 'sentry/utils/getDisplayName';
import useApi from 'sentry/utils/useApi';

type InjectedApiProps = {
  api: Client;
};

type WrappedProps<P> = Omit<P, keyof InjectedApiProps> & Partial<InjectedApiProps>;

/**
 * XXX: Prefer useApi if you are wrapping a Function Component!
 *
 * React Higher-Order Component (HoC) that provides "api" client when mounted,
 * and clears API requests when component is unmounted.
 *
 * If an `api` prop is provided when the component is invoked it will be passed
 * through.
 */
const withApi = <P extends InjectedApiProps>(
  WrappedComponent: React.ComponentType<P>,
  options: Parameters<typeof useApi>[0] = {}
) => {
  function WithApi({api: propsApi, ...props}: WrappedProps<P>) {
    const api = useApi({api: propsApi, ...options});

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...(props as P as any)} api={api} />;
  }

  WithApi.displayName = `withApi(${getDisplayName(WrappedComponent)})`;

  return WithApi;
};

export default withApi;
