import sortBy from 'lodash/sortBy';
import property from 'lodash/property';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';

import {isUrl, percent} from 'app/utils';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import UserAvatar from 'app/components/avatar/userAvatar';
import DeviceName from 'app/components/deviceName';
import ExternalLink from 'app/components/links/externalLink';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import TimeSince from 'app/components/timeSince';
import withOrganization from 'app/utils/withOrganization';

class GroupTagValues extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    group: SentryTypes.Group.isRequired,
    query: PropTypes.object,
  };

  state = {
    tagKey: null,
    tagValueList: null,
    loading: true,
    error: false,
    pageLinks: '',
  };

  componentWillMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    const queryHasChanged = !isEqual(prevProps.query, this.props.query);
    if (queryHasChanged || prevProps.params.tagKey !== this.props.params.tagKey) {
      this.fetchData();
    }
  }

  fetchData = async () => {
    const {params, query} = this.props;
    this.setState({
      loading: true,
      error: false,
    });

    const promises = [
      this.props.api.requestPromise(`/issues/${params.groupId}/tags/${params.tagKey}/`, {
        query,
      }),
      this.props.api.requestPromise(
        `/issues/${params.groupId}/tags/${params.tagKey}/values/`,
        {
          query,
          includeAllArgs: true,
        }
      ),
    ];

    try {
      const [tagKey, tagValueResponse] = await Promise.all(promises);
      const [tagValueList, , jqXHR] = tagValueResponse;

      this.setState({
        tagKey,
        tagValueList,
        loading: false,
        pageLinks: jqXHR.getResponseHeader('Link'),
      });
    } catch (rejections) {
      // eslint-disable-next-line no-console
      console.error(rejections);
      this.setState({
        error: true,
        loading: false,
      });
    }
  };

  getUserDisplayName(item) {
    return item.email || item.username || item.identifier || item.ipAddress || item.value;
  }

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const {
      group,
      params: {orgId},
    } = this.props;
    const tagKey = this.state.tagKey;

    const sortedTagValueList = sortBy(
      this.state.tagValueList,
      property('count')
    ).reverse();

    const issuesPath = `/organizations/${orgId}/issues/`;

    const children = sortedTagValueList.map((tagValue, tagValueIdx) => {
      const pct = percent(tagValue.count, tagKey.totalValues).toFixed(2);
      const query = tagValue.query || `${tagKey.key}:"${tagValue.value}"`;
      return (
        <tr key={tagValueIdx}>
          <td className="bar-cell">
            <span className="bar" style={{width: pct + '%'}} />
            <span className="label">{pct}%</span>
          </td>
          <td>
            <GlobalSelectionLink
              to={{
                pathname: issuesPath,
                query: {query},
              }}
            >
              {tagKey.key === 'user' ? (
                <React.Fragment>
                  <UserAvatar user={tagValue} size={20} className="avatar" />
                  <span style={{marginLeft: 10}}>
                    {this.getUserDisplayName(tagValue)}
                  </span>
                </React.Fragment>
              ) : (
                <DeviceName>{tagValue.name}</DeviceName>
              )}
            </GlobalSelectionLink>
            {tagValue.email && (
              <ExternalLink href={`mailto:${tagValue.email}`} className="external-icon">
                <em className="icon-envelope" />
              </ExternalLink>
            )}
            {isUrl(tagValue.value) && (
              <a href={tagValue.value} className="external-icon">
                <em className="icon-open" />
              </a>
            )}
          </td>
          <td>
            <TimeSince date={tagValue.lastSeen} />
          </td>
        </tr>
      );
    });

    return (
      <div>
        <h3>
          {tagKey.key === 'user' ? t('Affected Users') : tagKey.name}
          <a
            href={`/${orgId}/${group.project.slug}/issues/${group.id}/tags/${
              this.props.params.tagKey
            }/export/`}
            className="btn btn-default btn-sm"
            style={{marginLeft: 10}}
          >
            {t('Export to CSV')}
          </a>
        </h3>
        <table className="table table-striped">
          <thead>
            <tr>
              <th style={{width: 30}}>%</th>
              <th />
              <th style={{width: 200}}>{t('Last Seen')}</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
        <Pagination pageLinks={this.state.pageLinks} />
        <p>
          <small>
            {t('Note: Percentage of issue is based on events seen in the last 7 days.')}
          </small>
        </p>
      </div>
    );
  }
}

export {GroupTagValues};
export default withApi(withOrganization(GroupTagValues));
