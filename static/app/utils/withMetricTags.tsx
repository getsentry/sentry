import * as React from 'react';

import MetricTagStore from 'sentry/stores/metricsTagStore';
import TagStore from 'sentry/stores/tagStore';
import {MetricTagCollection} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedTagsProps = {
  metricTags: MetricTagCollection;
};

type State = {
  metricTags: MetricTagCollection;
};

function withMetricTags<P extends InjectedTagsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithMetricTags extends React.Component<Omit<P, keyof InjectedTagsProps>, State> {
    static displayName = `withMetricTags(${getDisplayName(WrappedComponent)})`;

    state: State = {
      metricTags: MetricTagStore.getAllTags(),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }
    unsubscribe = TagStore.listen(
      (metricTags: MetricTagCollection) => this.setState({metricTags}),
      undefined
    );

    render() {
      const {metricTags, ...props} = this.props as P;
      return (
        <WrappedComponent
          {...({metricTags: metricTags ?? this.state.metricTags, ...props} as P)}
        />
      );
    }
  }

  return WithMetricTags;
}

export default withMetricTags;
