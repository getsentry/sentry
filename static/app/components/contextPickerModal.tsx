import {Component, Fragment} from 'react';
import ReactDOM from 'react-dom';
import {components, StylesConfig} from 'react-select';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import AsyncComponent from 'app/components/asyncComponent';
import SelectControl from 'app/components/forms/selectControl';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t, tct} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import OrganizationsStore from 'app/stores/organizationsStore';
import OrganizationStore from 'app/stores/organizationStore';
import space from 'app/styles/space';
import {Integration, Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import IntegrationIcon from 'app/views/organizationIntegrations/integrationIcon';

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
  integrationConfigs: Integration[];
};

const selectStyles = {
  menu: (provided: StylesConfig) => ({
    ...provided,
    position: 'auto',
    boxShadow: 'none',
    marginBottom: 0,
  }),
  option: (provided: StylesConfig, state: any) => ({
    ...provided,
    opacity: state.isDisabled ? 0.6 : 1,
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    pointerEvents: state.isDisabled ? 'none' : 'auto',
  }),
};

class ContextPickerModal extends Component<Props> {
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

  // TODO(ts) The various generics in react-select types make getting this
  // right hard.
  orgSelect: any | null = null;
  projectSelect: any | null = null;
  configSelect: any | null = null;

  // Performs checks to see if we need to prompt user
  // i.e. When there is only 1 org and no project is needed or
  // there is only 1 org and only 1 project (which should be rare)
  navigateIfFinish = (
    organizations: Array<{slug: string}>,
    projects: Array<{slug: string}>,
    latestOrg: string = this.props.organization
  ) => {
    const {needProject, onFinish, nextPath, integrationConfigs} = this.props;
    const {isSuperuser} = ConfigStore.get('user') || {};

    // If no project is needed and theres only 1 org OR
    // if we need a project and there's only 1 project
    // then return because we can't navigate anywhere yet
    if (
      (!needProject && organizations.length !== 1) ||
      (needProject && projects.length !== 1) ||
      (integrationConfigs.length && isSuperuser)
    ) {
      return;
    }

    // If there is only one org and we don't need a project slug, then call finish callback
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

  doFocus = (ref: any | null) => {
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

  handleSelectConfiguration = ({value}: {value: string}) => {
    const {onFinish, nextPath} = this.props;

    if (!value) {
      return;
    }

    onFinish(`${nextPath}${value}/`);
    return;
  };

  getMemberProjects = () => {
    const {projects} = this.props;
    const nonMemberProjects: Project[] = [];
    const memberProjects: Project[] = [];
    projects.forEach(project =>
      project.isMember ? memberProjects.push(project) : nonMemberProjects.push(project)
    );

    return [memberProjects, nonMemberProjects];
  };

  onMenuOpen = (
    ref: any | null,
    listItems: (Project | Integration)[],
    valueKey: string,
    currentSelected: string = ''
  ) => {
    // Hacky way to pre-focus to an item with newer versions of react select
    // See https://github.com/JedWatson/react-select/issues/3648
    setTimeout(() => {
      if (ref) {
        const choices = ref.select.state.menuOptions.focusable;
        const toBeFocused = listItems.find(({id}) => id === currentSelected);
        const selectedIndex = toBeFocused
          ? choices.findIndex(option => option.value === toBeFocused[valueKey])
          : 0;
        if (selectedIndex >= 0 && toBeFocused) {
          // Focusing selected option only if it exists
          ref.select.scrollToFocusedOptionOnUpdate = true;
          ref.select.inputIsHiddenAfterUpdate = false;
          ref.select.setState({
            focusedValue: null,
            focusedOption: choices[selectedIndex],
          });
        }
      }
    });
  };

  // TODO(TS): Fix typings
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
    const {needOrg, needProject, integrationConfigs} = this.props;
    if (needOrg && needProject) {
      return t('Select an organization and a project to continue');
    }
    if (needOrg) {
      return t('Select an organization to continue');
    }
    if (needProject) {
      return t('Select a project to continue');
    }
    if (integrationConfigs.length) {
      return t('Select a configuration to continue');
    }
    // if neither project nor org needs to be selected, nothing will render anyways
    return '';
  }

  renderProjectSelectOrMessage() {
    const {organization, projects, comingFromProjectId} = this.props;
    const [memberProjects, nonMemberProjects] = this.getMemberProjects();
    const {isSuperuser} = ConfigStore.get('user') || {};

    const projectOptions = [
      {
        label: t('My Projects'),
        options: memberProjects.map(p => ({
          value: p.slug,
          label: t(`${p.slug}`),
          isDisabled: false,
        })),
      },
      {
        label: t('All Projects'),
        options: nonMemberProjects.map(p => ({
          value: p.slug,
          label: t(`${p.slug}`),
          isDisabled: isSuperuser ? false : true,
        })),
      },
    ];

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
        ref={(ref: any) => {
          this.projectSelect = ref;
          this.doFocus(this.projectSelect);
        }}
        placeholder={t('Select a Project to continue')}
        name="project"
        options={projectOptions}
        onChange={this.handleSelectProject}
        onMenuOpen={() =>
          this.onMenuOpen(this.projectSelect, projects, 'slug', comingFromProjectId)
        }
        components={{Option: this.customOptionProject, DropdownIndicator: null}}
        styles={selectStyles}
        menuIsOpen
      />
    );
  }

  renderIntegrationConfigs() {
    const {integrationConfigs} = this.props;
    const {isSuperuser} = ConfigStore.get('user') || {};

    const options = [
      {
        label: tct('[providerName] Configurations', {
          providerName: integrationConfigs[0].provider.name,
        }),
        options: integrationConfigs.map(config => ({
          value: config.id,
          label: (
            <StyledIntegrationItem>
              <IntegrationIcon size={22} integration={config} />
              <span>{config.domainName}</span>
            </StyledIntegrationItem>
          ),
          isDisabled: isSuperuser ? false : true,
        })),
      },
    ];
    return (
      <StyledSelectControl
        ref={(ref: any) => {
          this.configSelect = ref;
          this.doFocus(this.configSelect);
        }}
        placeholder={t('Select a configuration to continue')}
        name="configurations"
        options={options}
        onChange={this.handleSelectConfiguration}
        onMenuOpen={() => this.onMenuOpen(this.configSelect, integrationConfigs, 'id')}
        components={{DropdownIndicator: null}}
        styles={selectStyles}
        menuIsOpen
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
      integrationConfigs,
    } = this.props;
    const {isSuperuser} = ConfigStore.get('user') || {};

    const shouldShowProjectSelector = organization && needProject && !loading;

    const shouldShowConfigSelector = integrationConfigs.length > 0 && isSuperuser;

    const orgChoices = organizations
      .filter(({status}) => status.id !== 'pending_deletion')
      .map(({slug}) => ({label: slug, value: slug}));

    const shouldShowPicker = needOrg || needProject || shouldShowConfigSelector;

    if (!shouldShowPicker) {
      return null;
    }

    return (
      <Fragment>
        <Header closeButton>{this.headerText}</Header>
        <Body>
          {loading && <StyledLoadingIndicator overlay />}
          {needOrg && (
            <StyledSelectControl
              ref={(ref: any) => {
                this.orgSelect = ref;
                if (shouldShowProjectSelector) {
                  return;
                }
                this.doFocus(this.orgSelect);
              }}
              placeholder={t('Select an Organization')}
              name="organization"
              options={orgChoices}
              value={organization}
              onChange={this.handleSelectOrganization}
              components={{DropdownIndicator: null}}
              styles={selectStyles}
              menuIsOpen
            />
          )}

          {shouldShowProjectSelector && this.renderProjectSelectOrMessage()}
          {shouldShowConfigSelector && this.renderIntegrationConfigs()}
        </Body>
      </Fragment>
    );
  }
}

type ContainerProps = Omit<
  Props,
  | 'projects'
  | 'loading'
  | 'organizations'
  | 'organization'
  | 'onSelectOrganization'
  | 'integrationConfigs'
> & {
  /**
   * List of slugs we want to be able to choose from
   */
  projectSlugs?: string[];
  configUrl?: string;
} & AsyncComponent['props'];

type ContainerState = {
  selectedOrganization?: string;
  organizations: Organization[];
  integrationConfigs?: Integration[];
} & AsyncComponent['state'];

class ContextPickerModalContainer extends AsyncComponent<ContainerProps, ContainerState> {
  getDefaultState() {
    const storeState = OrganizationStore.get();
    return {
      ...super.getDefaultState(),
      organizations: OrganizationsStore.getAll(),
      selectedOrganization: storeState.organization?.slug,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {configUrl} = this.props;
    if (configUrl) {
      return [['integrationConfigs', configUrl]];
    }
    return [];
  }

  componentWillUnmount() {
    this.unlistener?.();
  }

  unlistener = OrganizationsStore.listen(
    (organizations: Organization[]) => this.setState({organizations}),
    undefined
  );

  handleSelectOrganization = (organizationSlug: string) => {
    this.setState({selectedOrganization: organizationSlug});
  };

  renderModal({
    projects,
    initiallyLoaded,
    integrationConfigs,
  }: {
    projects?: Project[];
    initiallyLoaded?: boolean;
    integrationConfigs?: Integration[];
  }) {
    return (
      <ContextPickerModal
        {...this.props}
        projects={projects || []}
        loading={!initiallyLoaded}
        organizations={this.state.organizations}
        organization={this.state.selectedOrganization!}
        onSelectOrganization={this.handleSelectOrganization}
        integrationConfigs={integrationConfigs || []}
      />
    );
  }

  render() {
    const {projectSlugs, configUrl} = this.props;

    if (configUrl && this.state.loading) {
      return <LoadingIndicator />;
    }
    if (this.state.integrationConfigs?.length) {
      return this.renderModal({
        integrationConfigs: this.state.integrationConfigs,
        initiallyLoaded: !this.state.loading,
      });
    }
    if (this.state.selectedOrganization) {
      return (
        <Projects
          orgId={this.state.selectedOrganization}
          allProjects={!projectSlugs?.length}
          slugs={projectSlugs}
        >
          {({projects, initiallyLoaded}) =>
            this.renderModal({projects: projects as Project[], initiallyLoaded})
          }
        </Projects>
      );
    }

    return this.renderModal({});
  }
}

export default ContextPickerModalContainer;

const StyledSelectControl = styled(SelectControl)`
  margin-top: ${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  z-index: 1;
`;

const StyledIntegrationItem = styled('div')`
  display: grid;
  grid-template-columns: ${space(4)} auto;
  grid-template-rows: 1fr;
`;
