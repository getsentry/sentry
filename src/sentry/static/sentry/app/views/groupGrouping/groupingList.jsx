import React, {PropTypes} from 'react';

import {t} from '../../locale';

const GroupingList = React.createClass({
  propTypes: {
    emptyMessage: PropTypes.node,
    store: PropTypes.shape({
      listen: PropTypes.func.isRequired
    }).isRequired
  },

  getDefaultProps() {
    return {
      emptyMessage: t('There are no items to display')
    };
  },

  getInitialState() {
    return {
      items: [],
      filteredItems: [],
      links: '',
      loading: true,
      error: false
    };
  },

  componentDidMount() {
    this.unsubscribe = this.props.store.listen(this.onStoreUpdate);
  },

  componentWillUnmount() {
    this.unsubscribe();
  },

  onStoreUpdate(update) {
    if (!update || !update.items) return;
    this.setState(update);
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>
          {this.props.emptyMessage}
        </p>
      </div>
    );
  },

  render() {
    let isLoading = this.state.loading;
    let isError = this.state.error && !isLoading;
    let isLoaded = !isLoading && !isError;

    return React.cloneElement(this.props.children, {
      isLoading,
      isError,
      isLoaded,
      emptyMessage: this.renderEmpty(),
      ...this.state
    });
  }
});

export default GroupingList;
