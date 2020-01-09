import {ModalBody, ModalHeader} from 'react-bootstrap';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {Organization, Project} from 'app/types';
import {t} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationStore from 'app/stores/organizationStore';
import OrganizationsStore from 'app/stores/organizationsStore';
import Projects from 'app/utils/projects';
import SelectControl from 'app/components/forms/selectControl';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import space from 'app/styles/space';

type Props = {
  /**
   * The destination route
   */
  nextPath: string;

  /**
   * Container for modal header
   */
  Header: typeof ModalHeader;

  /**
   * Container for modal body
   */
  Body: typeof ModalBody;

  /**
   * List of available organizations
   */
  organizations: Organization[];

  /**
   * Does modal need to prompt for organization.
   * TODO(billy): This can be derived from `nextPath`
   */
  needOrg: boolean;

  /**
   * Does modal need to prompt for project
   */
  needProject: boolean;

  /**
   * Organization slug
   */
  organization: string;

  projects: Project[];
  loading: boolean;

  /**
   * Finish callback
   */
  onFinish: (path: string) => void;

  /**
   * Callback for when organization is selected
   */
  onSelectOrganization: (orgSlug: string) => void;
};

class ContextPickerModal extends React.Component<Props> {
  componentDidMount() {
    const {organization, projects, organizations} = this.props;

    // Don't make any assumptions if there are multiple organizations
    if (organizations.length !== 1) {
      return;
    }

    // If there is an org in context (and there's only 1 org available),
    // attempt to see if we need more info from user and redirect otherwise
    if (organization) {
      // This will handle if we can intelligently move the user forward
      this.navigateIfFinish([{slug: organization}], projects);
      return;
    }
  }

  componentDidUpdate(prevProps) {
    // Component may be mounted before projects is fetched, check if we can finish when
    // component is updated with projects
    if (prevProps.projects !== this.props.projects) {
      this.navigateIfFinish(this.props.organizations, this.props.projects);
    }
  }

  orgSelect: Element | null = null;
  projectSelect: Element | null = null;

  // Performs checks to see if we need to prompt user
  // i.e. When there is only 1 org and no project is needed or
  // there is only 1 org and only 1 project (which should be rare)
  navigateIfFinish = (
    organizations: Array<{slug: string}>,
    projects: Array<{slug: string}>,
    latestOrg: string = this.props.organization
  ) => {
    const {needProject, onFinish, nextPath} = this.props;

    // If no project is needed and theres only 1 org OR
    // if we need a project and there's only 1 project
    // then return because we can't navigate anywhere yet
    if (
      (!needProject && organizations.length !== 1) ||
      (needProject && projects.length !== 1)
    ) {
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
      org = organizations[0].slug;
    }

    onFinish(
      replaceRouterParams(nextPath, {
        orgId: org,
        projectId: projects[0].slug,
      })
    );
  };

  doFocus = (ref: Element | null) => {
    if (!ref || this.props.loading) {
      return;
    }

    // eslint-disable-next-line react/no-find-dom-node
    const el = ReactDOM.findDOMNode(ref) as HTMLElement;

    if (el !== null) {
      const input = el.querySelector('input');

      input && input.focus();
    }
  };

  focusProjectSelector = () => {
    this.doFocus(this.projectSelect);
  };

  focusOrganizationSelector = () => {
    this.doFocus(this.orgSelect);
  };

  handleSelectOrganization = ({value}: {value: string}) => {
    // If we do not need to select a project, we can early return after selecting an org
    // No need to fetch org details
    if (!this.props.needProject) {
      this.navigateIfFinish([{slug: value}], []);
      return;
    }

    this.props.onSelectOrganization(value);
  };

  handleSelectProject = ({value}: {value: string}) => {
    const {organization} = this.props;
    if (!value || !organization) {
      return;
    }

    this.navigateIfFinish([{slug: organization}], [{slug: value}]);
  };

  render() {
    const {
      needOrg,
      needProject,
      organization,
      organizations,
      projects,
      loading,
      Header,
      Body,
    } = this.props;

    const shouldShowPicker = needOrg || needProject;

    if (!shouldShowPicker) {
      return null;
    }

    const shouldShowProjectSelector = organization && needProject && projects;

    const orgChoices = organizations
      .filter(({status}) => status.id !== 'pending_deletion')
      .map(({slug}) => ({label: slug, value: slug}));

    return (
      <React.Fragment>
        <Header closeButton>{t('Select...')}</Header>
        <Body>
          {loading && <StyledLoadingIndicator overlay />}
          <div>{t('Select an organization/project to continue')}</div>
          {needOrg && (
            <StyledSelectControl
              innerRef={ref => {
                this.orgSelect = ref;
                if (shouldShowProjectSelector) {
                  return;
                }
                this.focusOrganizationSelector();
              }}
              placeholder={t('Select an Organization')}
              name="organization"
              options={orgChoices}
              openOnFocus
              value={organization}
              onChange={this.handleSelectOrganization}
            />
          )}

          {organization && needProject && projects && (
            <StyledSelectControl
              innerRef={ref => {
                this.projectSelect = ref;
                this.focusProjectSelector();
              }}
              placeholder={t('Select a Project')}
              name="project"
              value=""
              openOnFocus
              options={projects.map(({slug}) => ({label: slug, value: slug}))}
              onChange={this.handleSelectProject}
            />
          )}
        </Body>
      </React.Fragment>
    );
  }
}

type ContainerProps = {};

type ContainerState = {
  organizations?: Organization[];
  selectedOrganization?: string;
};

const ContextPickerModalContainer = createReactClass<ContainerProps, ContainerState>({
  displayName: 'ContextPickerModalContainer',
  mixins: [Reflux.connect(OrganizationsStore, 'organizations') as any],
  getInitialState() {
    return {
      selectedOrganization:
        OrganizationStore.organization && OrganizationStore.organization.slug,
    };
  },

  handleSelectOrganization(organizationSlug) {
    this.setState({selectedOrganization: organizationSlug});
  },

  renderModal({projects, fetching}) {
    return (
      <ContextPickerModal
        {...this.props}
        projects={projects}
        loading={fetching}
        organizations={this.state.organizations}
        organization={this.state.selectedOrganization}
        onSelectOrganization={this.handleSelectOrganization}
      />
    );
  },

  render() {
    if (this.state.selectedOrganization) {
      return (
        <Projects orgId={this.state.selectedOrganization} allProjects>
          {renderProps => this.renderModal(renderProps)}
        </Projects>
      );
    }

    return this.renderModal({});
  },
});

export default ContextPickerModalContainer;

const StyledSelectControl = styled(SelectControl)`
  margin-top: ${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  z-index: 1;
`;
