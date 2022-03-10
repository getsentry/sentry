import * as React from 'react';

import MetricsMetaStore from 'sentry/stores/metricsMetaStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {MetricsMetaCollection} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

export type InjectedMetricsMetaProps = {
  metricsMeta: MetricsMetaCollection;
};

function withMetricsMeta<P extends InjectedMetricsMetaProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedMetricsMetaProps> &
    Partial<InjectedMetricsMetaProps>;

  const WithMetricsMeta: React.FC<Props> = props => {
    const {metricsMeta} = useLegacyStore(MetricsMetaStore);

    return <WrappedComponent {...(props as P)} metricsMeta={metricsMeta} />;
  };

  WithMetricsMeta.displayName = `withMetricsMeta(${getDisplayName(WrappedComponent)})`;

  return WithMetricsMeta;
}

export default withMetricsMeta;
