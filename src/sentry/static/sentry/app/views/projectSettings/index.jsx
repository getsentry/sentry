import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Badge from 'app/components/badge';
import ListLink from 'app/components/listLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';
import PluginNavigation from 'app/views/projectSettings/pluginNavigation';
import ExternalLink from 'app/components/externalLink';

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
    const {setProjectNavSection} = this.props;

    setProjectNavSection('settings');
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    const params = this.props.params;
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
    const params = this.props.params;

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
    // TODO(dcramer): move sidebar into component
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    const access = this.getAccess();
    const {orgId, projectId} = this.props.params;
    const pathPrefix = `/settings/${orgId}/projects/${projectId}`;
    const settingsUrlRoot = pathPrefix;
    const project = this.state.project;
    const rootInstallPath = `${pathPrefix}/install/`;
    const path = this.props.location.pathname;
    const processingIssues = this.state.project.processingIssues;

    return (
      <div className="row">
        <div className="col-md-2">
          <h6 className="nav-header">{t('Configuration')}</h6>
          <ul className="nav nav-stacked">
            <ListLink to={`${pathPrefix}/`} index={true}>
              {t('General')}
            </ListLink>
            <ListLink
              to={`${pathPrefix}/alerts/`}
              isActive={loc => path.indexOf(loc.pathname) === 0}
            >
              {t('Alerts')}
            </ListLink>
            <ListLink
              to={`${pathPrefix}/environments/`}
              isActive={loc => path.indexOf(loc.pathname) === 0}
            >
              {t('Environments')}
            </ListLink>
            <ListLink to={`${pathPrefix}/tags/`}>{t('Tags')}</ListLink>
            {access.has('project:write') && (
              <ListLink
                to={`${pathPrefix}/release-tracking/`}
                isActive={loc => path.indexOf(loc.pathname) === 0}
              >
                {t('Release Tracking')}
              </ListLink>
            )}
            <ListLink to={`${pathPrefix}/data-forwarding/`}>
              {t('Data Forwarding')}
            </ListLink>
            <ListLink to={`${pathPrefix}/saved-searches/`}>
              {t('Saved Searches')}
            </ListLink>
            <ListLink to={`${pathPrefix}/debug-symbols/`}>
              {t('Debug Information Files')}
            </ListLink>
            <ListLink className="badged" to={`${pathPrefix}/processing-issues/`}>
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
            <ListLink to={`${pathPrefix}/security-headers/`}>
              {t('Security Headers')}
            </ListLink>
            <ListLink to={`${pathPrefix}/user-feedback/`}>{t('User Feedback')}</ListLink>
            <ListLink to={`${pathPrefix}/filters/`}>{t('Inbound Filters')}</ListLink>
            <ListLink to={`${pathPrefix}/keys/`}>{t('Client Keys')} (DSN)</ListLink>
          </ul>
          <h6 className="nav-header">{t('Legacy Integrations')}</h6>
          <ul className="nav nav-stacked">
            <ListLink to={`${pathPrefix}/plugins/`}>{t('Legacy Integrations')}</ListLink>
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
