import React from 'react';
import {Link, History} from 'react-router';
import jQuery from 'jquery';
import ApiMixin from '../mixins/apiMixin';
import Count from '../components/count';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import TimeSince from '../components/timeSince';
import {isUrl, percent} from '../utils';
import {t, tn} from '../locale';

const GroupTagValues = React.createClass({
  mixins: [
    ApiMixin,
    History,
    GroupState
  ],

  getInitialState() {
    return {
      tagKey: null,
      tagValueList: null,
      loading: true,
      error: false,
      pageLinks: ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (prevProps.location.search !== this.props.location.search) {
      this.fetchData();
    }
  },

  fetchData() {
    let params = this.props.params;
    let queryParams = this.props.location.query;
    let querystring = jQuery.param(queryParams);

    this.setState({
      loading: true,
      error: false
    });

    this.api.request('/issues/' + this.getGroup().id + '/tags/' + params.tagKey + '/', {
      success: (data) => {
        this.setState({
          tagKey: data,
          loading: this.state.tagValueList === null
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });

    this.api.request('/issues/' + this.getGroup().id + '/tags/' + params.tagKey + '/values/?' + querystring, {
      success: (data, _, jqXHR) => {
        this.setState({
          tagValueList: data,
          loading: this.state.tagKey === null,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    let tagKey = this.state.tagKey;
    let children = this.state.tagValueList.map((tagValue, tagValueIdx) => {
      let pct = percent(tagValue.count, tagKey.totalValues).toFixed(2);
      let orgId = this.getOrganization().slug;
      let projectId = this.getProject().slug;
      return (
        <tr key={tagValueIdx}>
          <td className="bar-cell">
            <span className="bar" style={{width: pct + '%'}}></span>
            <span className="label">{pct}%</span>
          </td>
          <td>
            <Link
                to={`/${orgId}/${projectId}/`}
                query={{query: tagKey.key + ':' + '"' + tagValue.value + '"'}}>
              {tagValue.name}
            </Link>
            {isUrl(tagValue.value) &&
              <a href={tagValue.value} className="external-icon">
                <em className="icon-open" />
              </a>
            }
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
          {tagKey.name + ' '}
          <small>{tn(
            '%2$d unique historical value',
            '%2$d unique historical values',
            tagKey.uniqueValues,
            <Count value={tagKey.uniqueValues} />
          )}</small>
        </h3>
        <div className="alert alert-info alert-block">
          {t('Data is based on events seen in the last 7 days.')}
        </div>
        <table className="table table-striped">
          <thead>
            <tr>
              <th style={{width: 30}}>%</th>
              <th>{t('Value')}</th>
              <th style={{width: 200}}>{t('Last Seen')}</th>
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
        <Pagination pageLinks={this.state.pageLinks}/>
      </div>
    );
  }
});

export default GroupTagValues;
