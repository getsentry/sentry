import React from 'react';

import LoadingPanel from 'app/views/events/loadingPanel';

type Props = {
  reloading: boolean;
  loading: boolean;
};

type State = {
  prevReloading: boolean;
  prevLoading: boolean;
  key: number;
};

class TransitionChart extends React.Component<Props, State> {
  state = {
    prevReloading: this.props.reloading,
    prevLoading: this.props.loading,
    key: 1,
  };

  static getDerivedStateFromProps(props: Props, state: State) {
    // Transitions are controlled using variables called:
    // - loading and,
    // - reloading (also called pending in other apps)
    //
    // This component remounts the chart to ensure the stable transition
    // from one data set to the next.

    const prevReloading = state.prevReloading;
    const nextReloading = props.reloading;

    const prevLoading = state.prevLoading;
    const nextLoading = props.loading;

    // whenever loading changes, we explicitly remount the children by updating
    // the key prop; regardless of what state reloading is in
    if (prevLoading !== nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1,
      };
    }

    // invariant: prevLoading === nextLoading

    // if loading is true, and hasn't changed from the previous re-render,
    // do not remount the children.
    if (nextLoading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key,
      };
    }

    // invariant: loading is false

    // whenever the chart is transitioning from the reloading (pending) state to a non-loading state,
    // remount the children
    if (prevReloading && !nextReloading) {
      return {
        prevReloading: nextReloading,
        prevLoading: nextLoading,
        key: state.key + 1,
      };
    }

    // do not remount the children in these remaining cases:
    // !prevReloading && !nextReloading (re-render with no prop change)
    // prevReloading && nextReloading (re-render with no prop change)
    // !prevReloading && nextReloading (from loaded to pending state)

    return {
      prevReloading: nextReloading,
      prevLoading: nextLoading,
      key: state.key,
    };
  }

  render() {
    const {loading, reloading} = this.props;

    if (loading && !reloading) {
      return <LoadingPanel data-test-id="events-request-loading" />;
    }

    // We make use of the key prop to explicitly remount the children
    // https://reactjs.org/docs/lists-and-keys.html#keys
    return (
      <React.Fragment key={String(this.state.key)}>{this.props.children}</React.Fragment>
    );
  }
}

export default TransitionChart;
