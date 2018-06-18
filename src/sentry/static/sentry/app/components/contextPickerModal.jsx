import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {fetchOrganizationDetails} from 'app/actionCreators/organizations';
import {t} from 'app/locale';
import LatestContextStore from 'app/stores/latestContextStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationsStore from 'app/stores/organizationsStore';
import SelectControl from 'app/components/forms/selectControl';
import SentryTypes from 'app/proptypes';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withProjects from 'app/utils/withProjects';
import space from 'app/styles/space';

class ContextPickerModal extends React.Component {
  static propTypes = {
    /**
     * The destination route
     */
    nextPath: PropTypes.string.isRequired,

    /**
     * Finish callback
     */
    onFinish: PropTypes.func.isRequired,

    /**
     * Container for modal header
     */
    Header: PropTypes.oneOfType([PropTypes.element, PropTypes.func, PropTypes.string]),

    /**
     * Container for modal body
     */
    Body: PropTypes.oneOfType([PropTypes.element, PropTypes.func, PropTypes.string]),

    /**
     * List of available organizations
     */
    organizations: PropTypes.arrayOf(SentryTypes.Organization),

    /**
     * LatestContext store
     */
    latestContext: PropTypes.shape({
      organization: SentryTypes.Organization,
    }),

    /**
     * Does modal need to prompt for organization.
     * TODO(billy): This can be derived from `nextPath`
     */
    needOrg: PropTypes.bool,

    /**
     * Does modal need to prompt for project
     */
    needProject: PropTypes.bool,
  };

  constructor(props) {
    super(props);

    let {needProject, latestContext} = props;

    let shouldHaveEmptyOrgSelector = !needProject || !latestContext.organization;
    this.state = {
      // Initialize loading to true if there is only 1 organization because component will immediately
      // attempt to fetch org details for that org. Otherwise we'd have to change state in `DidMount`
      loading: props.organizations.length === 1,

      // Org select should be empty except if we need a project and there's an org in context
      // (otherwise they need to select an org before we can fetch projects)
      selectedOrganization: shouldHaveEmptyOrgSelector
        ? ''
        : latestContext.organization.slug,
    };
  }

  componentDidMount() {
    let {latestContext, organizations} = this.props;

    // Don't make any assumptions if there are multiple organizations
    if (organizations.length !== 1) {
      return;
    }

    // If there is an org in context (and there's only 1 org available),
    // attempt to see if we need more info from user and redirect otherwise
    if (latestContext.organization) {
      // This will handle if we can intelligently move the user forward
      this.navigateIfFinish(
        [latestContext.organization],
        latestContext.organization.projects
      );
      return;
    }

    // Since user belongs to only 1 org, we can set it as active and componentWillReceiveProps handle the rest
    fetchOrganizationDetails(organizations[0].slug, {
      setActive: true,
      loadProjects: true,
    });
  }

  componentWillReceiveProps(nextProps) {
    // Should only check the case where there is no latestContext.organization and we're waiting
    // for it to be set (after fetch in DidMount)
    let {latestContext} = this.props;
    if (
      (!latestContext.organization &&
        latestContext.organization !== nextProps.latestContext.organization) ||
      (latestContext.organization &&
        nextProps.latestContext.organization &&
        latestContext.organization.slug !== nextProps.latestContext.organization.slug)
    ) {
      // Check if we can push the user forward w/o needing them to select anything
      this.navigateIfFinish(
        this.props.organizations,
        nextProps.latestContext.organization.projects,
        nextProps.latestContext.organization
      );
    }
  }

  // Performs checks to see if we need to prompt user
  // i.e. When there is only 1 org and no project is needed or
  // there is only 1 org and only 1 project (which should be rare)
  navigateIfFinish = (
    organizations,
    projects,
    latestOrg = this.props.latestContext && this.props.latestContext.organization
  ) => {
    let {needProject, onFinish, nextPath} = this.props;

    // If no project is needed and theres only 1 org OR
    // if we need a project and there's only 1 project
    // then return because we can't navigate anywhere yet
    if (
      (!needProject && organizations.length !== 1) ||
      (needProject && projects.length !== 1)
    ) {
      this.setState({loading: false});
      return;
    }

    // If there is only one org and we dont need a project slug, then call finish callback
    if (!needProject) {
      onFinish(
        replaceRouterParams(nextPath, {
          orgId: organizations[0].slug,
        })
      );
      return;
    }

    // Use latest org or if only 1 org, use that
    let org = latestOrg;
    if (!org && organizations.length === 1) {
      org = organizations[0];
    }

    onFinish(
      replaceRouterParams(nextPath, {
        orgId: org.slug,
        projectId: projects[0].slug,
      })
    );
  };

  focusProjectSelector = () => {
    if (!this.projectSelect || this.state.loading) return;

    // eslint-disable-next-line react/no-find-dom-node
    ReactDOM.findDOMNode(this.projectSelect)
      .querySelector('input')
      .focus();
  };

  focusOrganizationSelector = () => {
    if (!this.orgSelect || this.state.loading) return;

    // eslint-disable-next-line react/no-find-dom-node
    ReactDOM.findDOMNode(this.orgSelect)
      .querySelector('input')
      .focus();
  };

  handleSelectOrganization = ({value}) => {
    // Don't do anything if org value doesn't actually change
    if (this.state.selectedOrganization === value) return;

    // If we do not need to select a project, we can early return after selecting an org
    // No need to fetch org details
    if (!this.props.needProject) {
      this.navigateIfFinish([{slug: value}], []);
      return;
    }

    this.setState(
      {
        selectedOrganization: value,
        loading: true,
      },
      () => fetchOrganizationDetails(value, {setActive: true, loadProjects: true})
    );
  };

  handleSelectProject = ({value}) => {
    let {latestContext} = this.props;

    if (!value || !latestContext.organization) return;

    this.navigateIfFinish([latestContext.organization], [{slug: value}]);
  };

  render() {
    let {latestContext, needOrg, needProject, organizations, Header, Body} = this.props;
    let {loading} = this.state;

    let shouldShowPicker = needOrg || needProject;

    let projects = latestContext.organization && latestContext.organization.projects;

    if (!shouldShowPicker) return null;

    let shouldShowProjectSelector = latestContext.organization && needProject && projects;

    let orgChoices = organizations
      .filter(({status}) => status.id !== 'pending_deletion')
      .map(({slug}) => ({label: slug, value: slug}));

    return (
      <div>
        <React.Fragment>
          <Header closeButton>{t('Select...')}</Header>
          <Body ref={this.handleBodyMount}>
            {loading && <StyledLoadingIndicator overlay />}
            <div>{t('Select an organization/project to continue')}</div>
            {needOrg && (
              <StyledSelectControl
                innerRef={ref => {
                  this.orgSelect = ref;
                  if (shouldShowProjectSelector) return;
                  this.focusOrganizationSelector();
                }}
                placeholder="Select an Organization"
                name="organization"
                options={orgChoices}
                openOnFocus
                value={this.state.selectedOrganization}
                onChange={this.handleSelectOrganization}
              />
            )}

            {latestContext.organization &&
              needProject &&
              projects && (
                <StyledSelectControl
                  innerRef={ref => {
                    this.projectSelect = ref;
                    this.focusProjectSelector();
                  }}
                  placeholder="Select a Project"
                  name="project"
                  value=""
                  openOnFocus
                  options={projects.map(({slug}) => ({label: slug, value: slug}))}
                  onChange={this.handleSelectProject}
                />
              )}
          </Body>
        </React.Fragment>
      </div>
    );
  }
}

const ContextPickerModalContainer = withProjects(
  createReactClass({
    displayName: 'ContextPickerModalContainer',
    mixins: [
      Reflux.connect(LatestContextStore, 'latestContext'),
      Reflux.connect(OrganizationsStore, 'organizations'),
    ],
    render() {
      return (
        <ContextPickerModal
          {...this.props}
          latestContext={this.state.latestContext}
          organizations={this.state.organizations}
        />
      );
    },
  })
);

export default ContextPickerModalContainer;
export {ContextPickerModal};

const StyledSelectControl = styled(SelectControl)`
  margin-top: ${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  z-index: 1;
`;
