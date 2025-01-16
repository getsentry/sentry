import {Component, Fragment} from 'react';
import {components} from 'react-select';
import styled from '@emotion/styled';
import type {Query} from 'history';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import type {StylesConfig} from 'sentry/components/forms/controls/selectControl';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {space} from 'sentry/styles/space';
import type {Integration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import Projects from 'sentry/utils/projects';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import IntegrationIcon from 'sentry/views/settings/organizationIntegrations/integrationIcon';

type SharedProps = ModalRenderProps & {
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
   * The destination route
   */
  nextPath: string | {pathname: string; query?: Query};

  /**
   * Finish callback
   * @param path type will match nextPath's type {@link Props.nextPath}
   */
  onFinish: (path: string | {pathname: string; query?: Query}) => number | void;

  allowAllProjectsSelection?: boolean;
};

type Props = SharedProps & {
  integrationConfigs: Integration[];

  loading: boolean;

  /**
   * Callback for when organization is selected
   */
  onSelectOrganization: (orgSlug: string) => void;

  /**
   * Organization slug
   */
  organization: string;

  /**
   * List of available organizations
   */
  organizations: Organization[];

  projects: Project[];
};

function autoFocusReactSelect(reactSelectRef: any) {
  reactSelectRef?.select?.focus?.();
}

const selectStyles: StylesConfig = {
  menu: provided => ({
    ...provided,
    position: 'initial',
    boxShadow: 'none',
    marginBottom: 0,
  }),
  option: (provided, state: any) => ({
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

  componentWillUnmount() {
    window.clearTimeout(this.onFinishTimeout);
  }

  onFinishTimeout: number | undefined = undefined;

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

    window.clearTimeout(this.onFinishTimeout);
    const pathname = typeof nextPath === 'string' ? nextPath : nextPath.pathname;

    // If there is only one org and we don't need a project slug, then call finish callback
    if (!needProject) {
      const newPathname = replaceRouterParams(pathname, {
        orgId: organizations[0]!.slug,
      });
      this.onFinishTimeout =
        onFinish(
          typeof nextPath === 'string'
            ? newPathname
            : {...nextPath, pathname: newPathname}
        ) ?? undefined;
      return;
    }

    // Use latest org or if only 1 org, use that
    let org = latestOrg;
    if (!org && organizations.length === 1) {
      org = organizations[0]!.slug;
    }

    const newPathname = replaceRouterParams(pathname, {
      orgId: org,
      projectId: projects[0]!.slug,
      project: this.props.projects.find(p => p.slug === projects[0]!.slug)?.id,
    });
    this.onFinishTimeout =
      onFinish(
        typeof nextPath === 'string' ? newPathname : {...nextPath, pathname: newPathname}
      ) ?? undefined;
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
    const newPath =
      typeof nextPath === 'string'
        ? `${nextPath}${value}/`
        : {
            ...nextPath,
            pathname: `${nextPath.pathname}${value}/`,
          };
    onFinish(newPath);
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

  // TODO(TS): Fix typings
  customOptionProject = ({label, ...props}: any) => {
    const project = this.props.projects.find(({slug}) => props.value === slug);
    if (!project) {
      return null;
    }
    return (
      <components.Option label={label} {...props}>
        <ProjectBadgeOption
          project={project}
          avatarSize={20}
          displayName={label}
          avatarProps={{consistentWidth: true}}
          disableLink
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
    const {organization, projects, allowAllProjectsSelection} = this.props;
    const [memberProjects, nonMemberProjects] = this.getMemberProjects();
    const {isSuperuser} = ConfigStore.get('user') || {};

    const projectOptions = [
      {
        label: t('My Projects'),
        options: memberProjects!.map(p => ({
          value: p.slug,
          label: p.slug,
          disabled: false,
        })),
      },
      {
        label: t('All Projects'),
        options: nonMemberProjects!.map(p => ({
          value: p.slug,
          label: p.slug,
          disabled: allowAllProjectsSelection ? false : !isSuperuser,
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
        ref={autoFocusReactSelect}
        placeholder={t('Select a Project to continue')}
        name="project"
        options={projectOptions}
        onChange={this.handleSelectProject}
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
          providerName: integrationConfigs[0]!.provider.name,
        }),
        options: integrationConfigs.map(config => ({
          value: config.id,
          label: (
            <StyledIntegrationItem>
              <IntegrationIcon size={22} integration={config} />
              <span>{config.domainName}</span>
            </StyledIntegrationItem>
          ),
          disabled: isSuperuser ? false : true,
        })),
      },
    ];
    return (
      <StyledSelectControl
        ref={autoFocusReactSelect}
        placeholder={t('Select a configuration to continue')}
        name="configurations"
        options={options}
        onChange={this.handleSelectConfiguration}
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
        <Header closeButton>
          <h5>{this.headerText}</h5>
        </Header>
        <Body>
          {loading && <StyledLoadingIndicator overlay />}
          {needOrg && (
            <StyledSelectControl
              ref={shouldShowProjectSelector ? undefined : autoFocusReactSelect}
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

type ContainerProps = SharedProps & {
  configUrl?: string;

  /**
   * List of slugs we want to be able to choose from
   */
  projectSlugs?: string[];
} & DeprecatedAsyncComponent['props'];

type ContainerState = {
  organizations: Organization[];
  integrationConfigs?: Integration[];
  selectedOrganization?: string;
} & DeprecatedAsyncComponent['state'];

class ContextPickerModalContainer extends DeprecatedAsyncComponent<
  ContainerProps,
  ContainerState
> {
  getDefaultState() {
    const storeState = OrganizationStore.get();
    return {
      ...super.getDefaultState(),
      organizations: OrganizationsStore.getAll(),
      selectedOrganization: storeState.organization?.slug,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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
    initiallyLoaded?: boolean;
    integrationConfigs?: Integration[];
    projects?: Project[];
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
        allowAllProjectsSelection={this.props.allowAllProjectsSelection}
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

const ProjectBadgeOption = styled(IdBadge)`
  margin: ${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  z-index: 1;
`;

const StyledIntegrationItem = styled('div')`
  display: grid;
  grid-template-columns: ${space(4)} auto;
  grid-template-rows: 1fr;
`;
