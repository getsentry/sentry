import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {fetchOrganizationDetails} from '../actionCreators/organizations';
import {t} from '../locale';
import LatestContextStore from '../stores/latestContextStore';
import LoadingIndicator from './loadingIndicator';
import OrganizationsStore from '../stores/organizationsStore';
import Select2Field from './forms/select2Field';
import SentryTypes from '../proptypes';
import replaceRouterParams from '../utils/replaceRouterParams';
import withProjects from '../utils/withProjects';

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

    this.state = {
      loading: props.organizations.length === 1,
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

    // If there is only one org and we dont need a project slug, then call finish callback
    if (!needProject) {
      if (organizations.length !== 1) {
        this.setState({loading: false});
        return;
      }

      onFinish(
        replaceRouterParams(nextPath, {
          orgId: organizations[0].slug,
        })
      );
    } else {
      if (projects.length !== 1) {
        this.setState({loading: false});
        return;
      }

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
    }
  };

  handleSelectOrganization = value => {
    if (!this.props.needProject) {
      this.navigateIfFinish([{slug: value}], []);
    }
    this.setState(
      {
        loading: true,
      },
      () => fetchOrganizationDetails(value, {setActive: true, loadProjects: true})
    );
  };

  handleSelectProject = projectId => {
    let {latestContext} = this.props;

    if (!projectId || !latestContext.organization) return;

    this.navigateIfFinish([latestContext.organization], [{slug: projectId}]);
  };

  render() {
    let {latestContext, needOrg, needProject, organizations, Header, Body} = this.props;
    let {loading} = this.state;

    let shouldShowPicker = needOrg || needProject;

    let projects = latestContext.organization && latestContext.organization.projects;

    if (!shouldShowPicker) return null;

    // We're inserting a blank el for `select2` so that we can have the placeholder :(
    let orgChoices = organizations
      .filter(({status}) => status.id !== 'pending_deletion')
      .map(({slug}) => [slug, slug]);

    return (
      <div>
        {loading && <LoadingIndicator />}
        {!loading && (
          <React.Fragment>
            <Header closeButton>{t('Select...')}</Header>
            <Body>
              <div css={{marginBottom: 12}}>
                {t('Select an organization/project to continue')}
              </div>
              {needOrg && (
                <Select2Field
                  placeholder="Select an Organization"
                  name="organization"
                  choices={[['', ''], ...orgChoices]}
                  value={
                    latestContext.organization ? latestContext.organization.slug : ''
                  }
                  onChange={this.handleSelectOrganization}
                />
              )}

              {latestContext.organization &&
                needProject &&
                projects && (
                  <Select2Field
                    placeholder="Select a Project"
                    name="project"
                    allowEmpty
                    value=""
                    choices={[['', ''], ...projects.map(({slug}) => [slug, slug])]}
                    onChange={this.handleSelectProject}
                  />
                )}
            </Body>
          </React.Fragment>
        )}
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
