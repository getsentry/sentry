import * as React from 'react';

import MetricsTagStore from 'sentry/stores/metricsTagStore';
import {MetricsTagCollection} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

export type InjectedMetricsTagsProps = {
  metricsTags: MetricsTagCollection;
};

type State = {
  metricsTags: MetricsTagCollection;
};

function withMetricsTags<P extends InjectedMetricsTagsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithMetricTags extends React.Component<
    Omit<P, keyof InjectedMetricsTagsProps>,
    State
  > {
    static displayName = `withMetricsTags(${getDisplayName(WrappedComponent)})`;

    state: State = {
      metricsTags: MetricsTagStore.getAllTags(),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }
    unsubscribe = MetricsTagStore.listen(
      (metricsTags: MetricsTagCollection) => this.setState({metricsTags}),
      undefined
    );

    render() {
      const {metricsTags, ...props} = this.props as P;
      return (
        <WrappedComponent
          {...({metricsTags: metricsTags ?? this.state.metricsTags, ...props} as P)}
        />
      );
    }
  }

  return WithMetricTags;
}

export default withMetricsTags;
