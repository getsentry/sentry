import React from 'react';

const LazyTooltip = React.lazy(() =>
  import(/* webpackChunkName: "Tooltip" */ './tooltip')
);

/**
 * This is a wrapper for the actual Tooltip component so that we can lazyload
 * the tooltip dependencies.
 */
export default class TooltipSuspense extends React.Component {
  render() {
    return (
      <React.Suspense fallback={this.props.children}>
        <LazyTooltip {...this.props} />
      </React.Suspense>
    );
  }
}
