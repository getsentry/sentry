import React from 'react';
import OrganizationState from '../../mixins/organizationState';
import ApiMixin from '../../mixins/apiMixin';
import Badge from '../../components/badge';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import {NavHeader, NavStacked, NavItem} from '../../components/navigation';
import {t} from '../../locale';

const ProjectSettings = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  contextTypes: {
    location: React.PropTypes.object,
    organization: React.PropTypes.object
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      project: null
    };
  },

  componentWillMount() {
    this.props.setProjectNavSection('settings');
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
          error: false
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
          error: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
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
    let features = new Set(project.features);
    let rootInstallPath = `/${orgId}/${projectId}/settings/install/`;
    let path = this.props.location.pathname;
    let processingIssues = this.state.project.processingIssues;

    return (
      <div className="row">
        <div className="col-md-2">
          <NavHeader>{t('Configuration')}</NavHeader>
          <NavStacked>
            <NavItem href={`${settingsUrlRoot}/`}>{t('General')}</NavItem>
            <NavItem
              to={`/${orgId}/${projectId}/settings/alerts/`}
              isActive={loc => path.indexOf(loc.pathname) === 0}>
              {t('Alerts')}
            </NavItem>
            {features.has('quotas') &&
              <NavItem href={`${settingsUrlRoot}/quotas/`}>
                {t('Rate Limits')}
              </NavItem>}
            <NavItem href={`${settingsUrlRoot}/tags/`}>{t('Tags')}</NavItem>
            <NavItem href={`${settingsUrlRoot}/issue-tracking/`}>
              {t('Issue Tracking')}
            </NavItem>
            {access.has('project:write') &&
              <NavItem
                to={`/${orgId}/${projectId}/settings/release-tracking/`}
                isActive={loc => path.indexOf(loc.pathname) === 0}>
                {t('Release Tracking')}
              </NavItem>}
            <NavItem to={`/${orgId}/${projectId}/settings/data-forwarding/`}>
              {t('Data Forwarding')}
            </NavItem>
            <NavItem to={`/${orgId}/${projectId}/settings/saved-searches/`}>
              {t('Saved Searches')}
            </NavItem>
            <NavItem to={`/${orgId}/${projectId}/settings/debug-symbols/`}>
              {t('Debug Information Files')}
            </NavItem>
            <NavItem
              className="badged"
              to={`/${orgId}/${projectId}/settings/processing-issues/`}>
              {t('Processing Issues')}
              {processingIssues > 0 &&
                <Badge
                  text={processingIssues > 99 ? '99+' : processingIssues + ''}
                  isNew={true}
                />}
            </NavItem>
          </NavStacked>
          <NavHeader className="nav-header">{t('Data')}</NavHeader>
          <NavStacked>
            <NavItem
              to={rootInstallPath}
              isActive={loc => {
                // Because react-router 1.0 removes router.isActive(route)
                return path === rootInstallPath || /install\/[\w\-]+\/$/.test(path);
              }}>
              {t('Error Tracking')}
            </NavItem>
            <NavItem to={`/${orgId}/${projectId}/settings/csp/`}>
              {t('CSP Reports')}
            </NavItem>
            <NavItem to={`/${orgId}/${projectId}/settings/user-feedback/`}>
              {t('User Feedback')}
            </NavItem>
            <NavItem to={`/${orgId}/${projectId}/settings/filters/`}>
              {t('Inbound Filters')}
            </NavItem>
            <NavItem to={`/${orgId}/${projectId}/settings/keys/`}>
              {t('Client Keys')} (DSN)
            </NavItem>
          </NavStacked>
          <NavHeader className="nav-header">{t('Integrations')}</NavHeader>
          <NavStacked>
            <NavItem href={`${settingsUrlRoot}/plugins/`}>
              {t('All Integrations')}
            </NavItem>
            {project.plugins.filter(p => p.enabled).map(plugin => {
              return (
                <NavItem
                  key={plugin.id}
                  href={`${settingsUrlRoot}/plugins/${plugin.id}/`}>
                  {plugin.name}
                </NavItem>
              );
            })}
          </NavStacked>
        </div>
        <div className="col-md-10">
          {React.cloneElement(this.props.children, {
            setProjectNavSection: this.props.setProjectNavSection,
            project: project,
            organization: this.context.organization
          })}
        </div>
      </div>
    );
  }
});

export default ProjectSettings;
