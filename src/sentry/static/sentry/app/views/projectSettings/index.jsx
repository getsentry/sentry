import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import Badge from '../../components/badge';
import ListLink from '../../components/listLink';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import OrganizationState from '../../mixins/organizationState';
import PluginNavigation from './pluginNavigation';
import ExternalLink from '../../components/externalLink';

const ProjectSettings = createReactClass({
  displayName: 'ProjectSettings',

  propTypes: {
    setProjectNavSection: PropTypes.func,
  },

  contextTypes: {
    location: PropTypes.object,
    organization: PropTypes.object,
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      project: null,
    };
  },

  componentWillMount() {
    let {setProjectNavSection} = this.props;

    setProjectNavSection('settings');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let params = this.props.params;
    if (
      nextProps.params.projectId !== params.projectId ||
      nextProps.params.orgId !== params.orgId
    ) {
      this.setState(
        {
          loading: true,
          error: false,
        },
        this.fetchData
      );
    }
  },

  fetchData() {
    let params = this.props.params;

    this.api.request(`/projects/${params.orgId}/${params.projectId}/`, {
      success: data => {
        this.setState({
          project: data,
          loading: false,
          error: false,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  render() {
    let access = this.getAccess();
    // TODO(dcramer): move sidebar into component
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let {orgId, projectId} = this.props.params;
    let settingsUrlRoot = `/${orgId}/${projectId}/settings`;
    let project = this.state.project;
    let rootInstallPath = `/${orgId}/${projectId}/settings/install/`;
    let path = this.props.location.pathname;
    let processingIssues = this.state.project.processingIssues;

    return (
      <div className="row">
        <div className="col-md-2">
          <h6 className="nav-header">{t('Configuration')}</h6>
          <ul className="nav nav-stacked">
            <ListLink to={`/${orgId}/${projectId}/settings/`} index={true}>
              {t('General')}
            </ListLink>
            <ListLink
              to={`/${orgId}/${projectId}/settings/alerts/`}
              isActive={loc => path.indexOf(loc.pathname) === 0}
            >
              {t('Alerts')}
            </ListLink>
            <ListLink
              to={`/${orgId}/${projectId}/settings/environments/`}
              isActive={loc => path.indexOf(loc.pathname) === 0}
            >
              {t('Environments')}
            </ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/tags/`}>{t('Tags')}</ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/issue-tracking/`}>
              {t('Issue Tracking')}
            </ListLink>
            {access.has('project:write') && (
              <ListLink
                to={`/${orgId}/${projectId}/settings/release-tracking/`}
                isActive={loc => path.indexOf(loc.pathname) === 0}
              >
                {t('Release Tracking')}
              </ListLink>
            )}
            <ListLink to={`/${orgId}/${projectId}/settings/data-forwarding/`}>
              {t('Data Forwarding')}
            </ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/saved-searches/`}>
              {t('Saved Searches')}
            </ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/debug-symbols/`}>
              {t('Debug Information Files')}
            </ListLink>
            <ListLink
              className="badged"
              to={`/${orgId}/${projectId}/settings/processing-issues/`}
            >
              {t('Processing Issues')}
              {processingIssues > 0 && (
                <Badge
                  text={processingIssues > 99 ? '99+' : processingIssues + ''}
                  isNew={true}
                />
              )}
            </ListLink>
          </ul>
          <h6 className="nav-header">{t('Data')}</h6>
          <ul className="nav nav-stacked">
            <ListLink
              to={rootInstallPath}
              isActive={loc => {
                // Because react-router 1.0 removes router.isActive(route)
                return path === rootInstallPath || /install\/[\w\-]+\/$/.test(path);
              }}
            >
              {t('Error Tracking')}
            </ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/csp/`}>
              {t('CSP Reports')}
            </ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/user-feedback/`}>
              {t('User Feedback')}
            </ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/filters/`}>
              {t('Inbound Filters')}
            </ListLink>
            <ListLink to={`/${orgId}/${projectId}/settings/keys/`}>
              {t('Client Keys')} (DSN)
            </ListLink>
          </ul>
          <h6 className="nav-header">{t('Integrations')}</h6>
          <ul className="nav nav-stacked">
            <ListLink to={`/${orgId}/${projectId}/settings/plugins/`}>
              {t('All Integrations')}
            </ListLink>
            <PluginNavigation urlRoot={settingsUrlRoot} />
          </ul>
        </div>
        <div className="col-md-10">
          {access.has('project:write') ? (
            React.cloneElement(this.props.children, {
              setProjectNavSection: this.props.setProjectNavSection,
              project,
              organization: this.context.organization,
            })
          ) : (
            <div className="alert alert-block">
              {t(
                'You’re restricted from accessing this page based on your organization role. Read more here: '
              )}
              <ExternalLink href="https://docs.sentry.io/learn/membership/">
                https://docs.sentry.io/learn/membership/
              </ExternalLink>
            </div>
          )}
        </div>
      </div>
    );
  },
});

export default ProjectSettings;
