import React from 'react';

const LazyHovercard = React.lazy(() =>
  import(/* webpackChunkName: "Hovercard" */ './hovercard')
);

/**
 * This is a wrapper for the actual Hovercard component so that we can lazyload
 * the tooltip dependencies.
 */
export default class HovercardSuspense extends React.Component {
  render() {
    return (
      <React.Suspense fallback={this.props.children}>
        <LazyHovercard {...this.props} />
      </React.Suspense>
    );
  }
}
