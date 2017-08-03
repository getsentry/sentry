import React, {PropTypes} from 'react';
import Reflux from 'reflux';

import {t} from '../../locale';
import {Event} from '../../proptypes';

import ApiMixin from '../../mixins/ApiMixin';
import MergedEventsStore from '../../stores/mergedEventsStore';
import IndicatorStore from '../../stores/indicatorStore';
import {unmergeSelected} from '../../actionCreators/mergedEvents';
import Pagination from '../../components/pagination';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import MergedEventItem from './mergedEventItem';
import MergedEventsToolbar from './mergedEventsToolbar';

const MergedEventsList = React.createClass({
  propTypes: {
    emptyMessage: PropTypes.node,
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    groupId: PropTypes.string,
    isLoading: PropTypes.bool.isRequired,
    isError: PropTypes.bool.isRequired,
    isLoaded: PropTypes.bool.isRequired,
    items: PropTypes.arrayOf(Event),
    links: PropTypes.string
  },

  mixins: [ApiMixin, Reflux.listenTo(MergedEventsStore, 'onStoreUpdate')],

  getDefaultProps() {
    return {
      isLoading: true,
      isError: false,
      isLoaded: false
    };
  },

  onStoreUpdate({unmergeStatus}) {
    if (!unmergeStatus) return;

    if (unmergeStatus === 'started') {
      IndicatorStore.add(t('Unmerging events...'));
    } else if (unmergeStatus === 'success') {
      IndicatorStore.add(t('Events successfully queued for unmerging.'), 'success', {
        duration: 5000
      });
    } else if (unmergeStatus === 'error') {
      IndicatorStore.add(t('Unable to queue events for unmerging.'), 'error');
    }
  },

  handleUnmerge() {
    let {groupId} = this.props;
    unmergeSelected(this.api, {
      groupId
    });
  },

  render() {
    let {
      isLoading,
      isError,
      isLoaded,
      items,
      error,
      emptyMessage,
      links,
      ...otherProps
    } = this.props;
    let hasResults = isLoaded && items.length > 0;
    let hasNoResults = isLoaded && !hasResults;

    return (
      <div className="grouping-list-container grouping-merged-list-container">
        <h2>
          {t('Merged with this Issue')}
        </h2>
        <MergedEventsToolbar onUnmerge={this.handleUnmerge} />

        <div className="grouping-list">
          {isLoading && <LoadingIndicator />}
          {isError && <LoadingError message={error} onRetry={this.fetchData} />}
          {hasNoResults && emptyMessage}
          {hasResults &&
            items.map(({id, latestEvent}) => (
              <MergedEventItem
                key={id}
                {...otherProps}
                event={latestEvent}
                fingerprint={id}
                itemCount={items.length}
              />
            ))}
        </div>
        <Pagination pageLinks={links} />
      </div>
    );
  }
});

export default MergedEventsList;
