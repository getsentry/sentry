/*eslint react/jsx-key:0*/
import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import jQuery from 'jquery';

import SentryTypes from 'app/proptypes';
import ApiMixin from 'app/mixins/apiMixin';
import Avatar from 'app/components/avatar';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import TimeSince from 'app/components/timeSince';
import DeviceName from 'app/components/deviceName';
import {isUrl, percent} from 'app/utils';
import {t} from 'app/locale';
import withEnvironment from 'app/utils/withEnvironment';

const GroupTagValues = createReactClass({
  displayName: 'GroupTagValues',

  propTypes: {
    environment: SentryTypes.Environment,
  },
  mixins: [ApiMixin],

  getInitialState() {
    return {
      tagKey: null,
      tagValueList: null,
      loading: true,
      error: false,
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (
      prevProps.location.search !== this.props.location.search ||
      prevProps.params.tagKey !== this.props.params.tagKey
    ) {
      this.fetchData();
    }
  },

  fetchData() {
    let params = this.props.params;
    let queryParams = this.props.location.query;
    let querystring = jQuery.param(queryParams);

    this.setState({
      loading: true,
      error: false,
    });

    const query = {};

    if (this.props.environment) {
      query.environment = this.props.environment.name;
    }

    this.api.request(`/issues/${params.groupId}/tags/${params.tagKey}/`, {
      query,
      success: data => {
        this.setState({
          tagKey: data,
          loading: this.state.tagValueList === null,
        });
      },
      error: error => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });

    this.api.request(
      `/issues/${params.groupId}/tags/${params.tagKey}/values/?${querystring}`,
      {
        success: (data, _, jqXHR) => {
          this.setState({
            tagValueList: data,
            loading: this.state.tagKey === null,
            pageLinks: jqXHR.getResponseHeader('Link'),
          });
        },
        error: error => {
          this.setState({
            error: true,
            loading: false,
          });
        },
      }
    );
  },

  getUserDisplayName(item) {
    return item.email || item.username || item.identifier || item.ipAddress || item.value;
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    let {orgId, projectId} = this.props.params;
    let tagKey = this.state.tagKey;
    let children = this.state.tagValueList.map((tagValue, tagValueIdx) => {
      let pct = percent(tagValue.count, tagKey.totalValues).toFixed(2);
      return (
        <tr key={tagValueIdx}>
          <td className="bar-cell">
            <span className="bar" style={{width: pct + '%'}} />
            <span className="label">{pct}%</span>
          </td>
          <td>
            <Link
              to={{
                pathname: `/${orgId}/${projectId}/`,
                query: {query: `${tagKey.key}:"${tagValue.value}"`},
              }}
            >
              {tagKey.key === 'user' ? (
                [
                  <Avatar user={tagValue} size={20} className="avatar" />,
                  <span style={{marginLeft: 10}}>
                    {this.getUserDisplayName(tagValue)}
                  </span>,
                ]
              ) : (
                <DeviceName>{tagValue.name}</DeviceName>
              )}
            </Link>
            {tagValue.email && (
              <a
                href={`mailto:${tagValue.email}`}
                target="_blank"
                className="external-icon"
              >
                <em className="icon-envelope" />
              </a>
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
          {tagKey.key == 'user' ? t('Affected Users') : tagKey.name}
          <a href="export/" className="btn btn-default btn-sm" style={{marginLeft: 10}}>
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
  },
});

export default withEnvironment(GroupTagValues);
