import ReactSelect, {components} from 'react-select';
import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import {t, tct} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationStore from 'app/stores/organizationStore';
import OrganizationsStore from 'app/stores/organizationsStore';
import Projects from 'app/utils/projects';
import SelectControl from 'app/components/forms/selectControl';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import space from 'app/styles/space';
import Link from 'app/components/links/link';
import IdBadge from 'app/components/idBadge';
import {ModalRenderProps} from 'app/actionCreators/modal';

type Props = ModalRenderProps & {
  /**
   * The destination route
   */
  nextPath: string;

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

  /**
   * Id of the project (most likely from the URL)
   * on which the modal was opened
   */
  comingFromProjectId?: string;
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

  componentDidUpdate(prevProps: Props) {
    // Component may be mounted before projects is fetched, check if we can finish when
    // component is updated with projects
    if (JSON.stringify(prevProps.projects) !== JSON.stringify(this.props.projects)) {
      this.navigateIfFinish(this.props.organizations, this.props.projects);
    }
  }

  orgSelect: ReactSelect | null = null;
  projectSelect: ReactSelect | null = null;

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
        project: this.props.projects.find(p => p.slug === projects[0].slug)?.id,
      })
    );
  };

  doFocus = (ref: ReactSelect | null) => {
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

  onProjectMenuOpen = () => {
    const {projects, comingFromProjectId} = this.props;
    // Hacky way to pre-focus to an item with newer versions of react select
    // See https://github.com/JedWatson/react-select/issues/3648
    setTimeout(() => {
      const ref = this.projectSelect;
      if (ref) {
        const projectChoices = ref.select.state.menuOptions.focusable;
        const projectToBeFocused = projects.find(({id}) => id === comingFromProjectId);
        const selectedIndex = projectChoices.findIndex(
          option => option.value === projectToBeFocused?.slug
        );
        if (selectedIndex >= 0 && projectToBeFocused) {
          // Focusing selected option only if it exists
          ref.select.scrollToFocusedOptionOnUpdate = true;
          ref.select.inputIsHiddenAfterUpdate = false;
          ref.select.setState({
            focusedValue: null,
            focusedOption: projectChoices[selectedIndex],
          });
        }
      }
    });
  };

  //TODO(TS): Fix typings
  customOptionProject = ({label, ...props}: any) => {
    const project = this.props.projects.find(({slug}) => props.value === slug);
    if (!project) {
      return null;
    }
    return (
      <components.Option label={label} {...props}>
        <IdBadge
          project={project}
          avatarSize={20}
          displayName={label}
          avatarProps={{consistentWidth: true}}
        />
      </components.Option>
    );
  };

  get headerText() {
    const {needOrg, needProject} = this.props;
    if (needOrg && needProject) {
      return t('Select an organization and a project to continue');
    }
    if (needOrg) {
      return t('Select an organization to continue');
    }
    if (needProject) {
      return t('Select a project to continue');
    }
    //if neither project nor org needs to be selected, nothing will render anyways
    return '';
  }

  renderProjectSelectOrMessage() {
    const {organization, projects} = this.props;
    if (!projects.length) {
      return (
        <div>
          {tct('You have no projects. Click [link] to make one.', {
            link: (
              <Link to={`/organizations/${organization}/projects/new/`}>{t('here')}</Link>
            ),
          })}
        </div>
      );
    }
    return (
      <StyledSelectControl
        ref={(ref: ReactSelect) => {
          this.projectSelect = ref;
          this.focusProjectSelector();
        }}
        placeholder={t('Select a Project')}
        name="project"
        openMenuOnFocus
        options={projects.map(({slug}) => ({label: slug, value: slug}))}
        onChange={this.handleSelectProject}
        onMenuOpen={this.onProjectMenuOpen}
        components={{Option: this.customOptionProject}}
      />
    );
  }

  render() {
    const {
      needOrg,
      needProject,
      organization,
      organizations,
      loading,
      Header,
      Body,
    } = this.props;

    const shouldShowPicker = needOrg || needProject;

    if (!shouldShowPicker) {
      return null;
    }

    const shouldShowProjectSelector = organization && needProject && !loading;

    const orgChoices = organizations
      .filter(({status}) => status.id !== 'pending_deletion')
      .map(({slug}) => ({label: slug, value: slug}));

    return (
      <React.Fragment>
        <Header closeButton>{this.headerText}</Header>
        <Body>
          {loading && <StyledLoadingIndicator overlay />}
          {needOrg && (
            <StyledSelectControl
              ref={(ref: ReactSelect) => {
                this.orgSelect = ref;
                if (shouldShowProjectSelector) {
                  return;
                }
                this.focusOrganizationSelector();
              }}
              placeholder={t('Select an Organization')}
              name="organization"
              options={orgChoices}
              openMenuOnFocus
              value={organization}
              onChange={this.handleSelectOrganization}
            />
          )}

          {shouldShowProjectSelector && this.renderProjectSelectOrMessage()}
        </Body>
      </React.Fragment>
    );
  }
}

type ContainerProps = Omit<
  Props,
  'projects' | 'loading' | 'organizations' | 'organization' | 'onSelectOrganization'
> & {
  /**
   * List of slugs we want to be able to choose from
   */
  projectSlugs?: string[];
};

type ContainerState = {
  organizations?: Organization[];
  selectedOrganization: string | null;
};

const ContextPickerModalContainer = createReactClass<ContainerProps, ContainerState>({
  displayName: 'ContextPickerModalContainer',
  mixins: [Reflux.connect(OrganizationsStore, 'organizations') as any],
  getInitialState() {
    const storeState = OrganizationStore.get();
    return {
      selectedOrganization: storeState.organization && storeState.organization.slug,
    };
  },

  handleSelectOrganization(organizationSlug: string) {
    this.setState({selectedOrganization: organizationSlug});
  },

  renderModal({projects, initiallyLoaded}) {
    return (
      <ContextPickerModal
        {...this.props}
        projects={projects || []}
        loading={!initiallyLoaded}
        organizations={this.state.organizations}
        organization={this.state.selectedOrganization}
        onSelectOrganization={this.handleSelectOrganization}
      />
    );
  },

  render() {
    const {projectSlugs} = this.props; // eslint-disable-line react/prop-types

    if (this.state.selectedOrganization) {
      return (
        <Projects
          orgId={this.state.selectedOrganization}
          allProjects={!projectSlugs?.length}
          slugs={projectSlugs}
        >
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
