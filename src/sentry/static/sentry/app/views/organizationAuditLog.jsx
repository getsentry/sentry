import React from 'react';
import DocumentTitle from 'react-document-title';
import {History} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import DateTime from '../components/dateTime';
import Gravatar from '../components/gravatar';
import LoadingIndicator from '../components/loadingIndicator';
import LoadingError from '../components/loadingError';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import OrganizationState from '../mixins/organizationState';
import Pagination from '../components/pagination';
import SelectInput from '../components/selectInput';

import {t} from '../locale';

const EVENT_TYPES = [
  'member.invite',
  'member.add',
  'member.accept-invite',
  'member.remove',
  'member.edit',
  'member.join-team',
  'member.leave-team',
  'team.create',
  'team.edit',
  'team.remove',
  'project.create',
  'project.edit',
  'project.remove',
  'project.set-public',
  'project.set-private',
  'org.create',
  'org.edit',
  'org.remove',
  'tagkey.remove',
  'projectkey.create',
  'projectkey.edit',
  'projectkey.remove',
  'projectkey.enable',
  'projectkey.disable',
  'sso.enable',
  'sso.disable',
  'sso.edit',
  'sso-identity.link',
  'api-key.create',
  'api-key.edit',
  'api-key.remove'
].sort();


const OrganizationAuditLog = React.createClass({
  mixins: [
    ApiMixin,
    History,
    OrganizationState,
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      entryList: [],
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.location.search !== this.props.location.search ||
        nextProps.params.orgId !== this.props.params.orgId) {
      this.remountComponent();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    this.setState({
      loading: true,
    });

    this.api.request(this.getEndpoint(), {
      query: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          entryList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      }
    });
  },

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/audit-logs/`;
  },

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Audit Log`;
  },

  onEventSelect(sel) {
    let value = sel.val();
    if (this.props.location.query.event === value) {
      return;
    }
    let queryParams = {
      event: value,
    };
    this.history.pushState(null, this.props.location.pathname, queryParams);
  },

  renderResults() {
    if (this.state.entryList.length === 0) {
      return <tr><td colSpan="4">{t('No results found.')}</td></tr>;
    }

    return this.state.entryList.map((entry) => {
      return (
        <tr key={entry.id}>
          <td className="table-user-info">
            {entry.actor.email &&
              <Gravatar user={entry.actor} />
            }
            <h5>{entry.actor.name}</h5>
            {entry.note}
          </td>
          <td>{entry.event}</td>
          <td>{entry.ipAddress}</td>
          <td>
            <DateTime date={entry.dateCreated} />
          </td>
        </tr>
      );
    });
  },

  render() {
    let currentEventType = this.props.location.query.event;

    return (
      <DocumentTitle title={this.getTitle()}>
        <OrganizationHomeContainer>
          <h3>{t('Audit Log')}</h3>

          <div className="pull-right">
            <form className="form-horizontal" style={{marginBottom: 20}}>
              <div className="control-group">
                <div className="controls">
                  <SelectInput name="event" onChange={this.onEventSelect}
                               value={currentEventType} style={{width: 250}}>
                    <option key="any" value="">{t('Any')}</option>
                    {EVENT_TYPES.map((eventType) => {
                      return <option key={eventType}>{eventType}</option>;
                    })}
                  </SelectInput>
                </div>
              </div>
            </form>
          </div>

          <p>{t('Sentry keeps track of important events within your organization.')}</p>

          <table className="table">
            <thead>
              <tr>
                <th>{t('Member')}</th>
                <th>{t('Action')}</th>
                <th>{t('IP')}</th>
                <th>{t('Time')}</th>
              </tr>
            </thead>
            <tbody>
              {(this.state.loading ?
                <tr><td colSpan="4"><LoadingIndicator /></td></tr>
              : (this.state.error ?
                <tr><td colSpan="4"><LoadingError onRetry={this.fetchData} /></td></tr>
              :
                this.renderResults()
              ))}
            </tbody>
          </table>
          {this.state.pageLinks &&
            <Pagination pageLinks={this.state.pageLinks} {...this.props} />
          }
        </OrganizationHomeContainer>
      </DocumentTitle>
    );
  },
});

export default OrganizationAuditLog;
