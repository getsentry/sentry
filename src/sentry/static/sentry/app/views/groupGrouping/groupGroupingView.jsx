import React, {PropTypes} from 'react';

import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import SimilarIssuesStore from '../../stores/similarIssuesStore';
import MergedEventsStore from '../../stores/mergedEventsStore';
import {loadSimilarIssues, loadMergedEvents} from '../../actionCreators/groups';

import GroupingList from './groupingList';
import MergedEventsList from './mergedEventsList';
import SimilarIssuesList from './similarIssuesList';

const GroupGroupingView = React.createClass({
  propTypes: {
    query: PropTypes.string
  },

  mixins: [ApiMixin],

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.params.groupId !== this.props.params.groupId ||
      nextProps.location.search !== this.props.location.search
    ) {
      this.fetchData();
    }
  },

  fetchData() {
    let params = {
      query: {
        limit: 50,
        ...this.props.location.query
      },
      groupId: this.props.params.groupId
    };

    loadMergedEvents(this.api, params);
    loadSimilarIssues(this.api, params);
  },

  render() {
    let {orgId, projectId, groupId} = this.props.params;

    return (
      <div>
        <div className="alert alert-block alert-warning">
          <strong>{t('Warning')}:</strong>{' '}
          {t(
            'This is an experimental feature. Data may not be immediately available while we process the unmerge.'
          )}
        </div>

        <GroupingList
          store={SimilarIssuesStore}
          emptyMessage={t('There are no similar issues.')}>
          <SimilarIssuesList orgId={orgId} projectId={projectId} groupId={groupId} />
        </GroupingList>

        <GroupingList
          store={MergedEventsStore}
          emptyMessage={t("There don't seem to be any hashes for this issue.")}>
          <MergedEventsList orgId={orgId} projectId={projectId} groupId={groupId} />
        </GroupingList>
      </div>
    );
  }
});

export default GroupGroupingView;
