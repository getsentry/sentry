import * as React from 'react';

import MetricsMetaStore from 'sentry/stores/metricsMetaStore';
import {MetricsMetaCollection} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedTagsProps = {
  metricsMeta: MetricsMetaCollection;
};

type State = {
  metricsMeta: MetricsMetaCollection;
};

function withMetricsMeta<P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithMetricMeta extends React.Component<Omit<P, keyof InjectedTagsProps>, State> {
    static displayName = `withMetricsMeta(${getDisplayName(WrappedComponent)})`;

    state: State = {
      metricsMeta: MetricsMetaStore.getAllFields(),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }
    unsubscribe = MetricsMetaStore.listen(
      (metricsMeta: MetricsMetaCollection) => this.setState({metricsMeta}),
      undefined
    );

    render() {
      const {metricsMeta, ...props} = this.props as P;
      return (
        <WrappedComponent
          {...({metricsMeta: metricsMeta ?? this.state.metricsMeta, ...props} as P)}
        />
      );
    }
  }

  return WithMetricMeta;
}

export default withMetricsMeta;
