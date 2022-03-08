import * as React from 'react';

import MetricsTagStore from 'sentry/stores/metricsTagStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {MetricsTagCollection} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

export type InjectedMetricsTagsProps = {
  metricsTags: MetricsTagCollection;
};

function withMetricsTags<P extends InjectedMetricsTagsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedMetricsTagsProps> &
    Partial<InjectedMetricsTagsProps>;

  const WithMetricsTags: React.FC<Props> = props => {
    const {metricsTags} = useLegacyStore(MetricsTagStore);

    return <WrappedComponent {...(props as P)} metricsTags={metricsTags} />;
  };

  WithMetricsTags.displayName = `withMetricsTags(${getDisplayName(WrappedComponent)})`;

  return WithMetricsTags;
}

export default withMetricsTags;
