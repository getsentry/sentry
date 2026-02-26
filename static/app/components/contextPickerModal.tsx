import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {Query} from 'history';

import {ProjectAvatar, TeamAvatar} from '@sentry/scraps/avatar';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {StylesConfig} from '@sentry/scraps/select';
import {Select} from '@sentry/scraps/select';
import {Heading} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Integration} from 'sentry/types/integrations';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {IntegrationIcon} from 'sentry/views/settings/organizationIntegrations/integrationIcon';

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
   * @param path type will match nextPath's type {@link SharedProps.nextPath}
   */
  onFinish: (path: string | {pathname: string; query?: Query}) => number | void;

  allowAllProjectsSelection?: boolean;

  /**
   * Does modal need to prompt for team
   */
  needTeam?: boolean;
};

type ContentProps = SharedProps & {
  organizations: Organization[];
  selectedOrgSlug: string | undefined;
  setSelectedOrgSlug: (slug: string) => void;
  projectSlugs?: string[];
};

type ContainerProps = SharedProps & {
  configQueryKey?: ApiQueryKey;

  /**
   * List of slugs we want to be able to choose from
   */
  projectSlugs?: string[];
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

function ContextPickerContent({
  organizations,
  selectedOrgSlug,
  setSelectedOrgSlug,
  projectSlugs,
  needOrg,
  needProject,
  needTeam = false,
  nextPath,
  onFinish,
  allowAllProjectsSelection,
  Header,
  Body,
}: ContentProps) {
  // --- Data fetching ---
  // Note: use `isLoading` (not `isPending`) because `isPending` is true when
  // `enabled` is false (query hasn't started). `isLoading` = isPending && isFetching,
  // so it's only true when the query is actively running.
  const {data: rawProjects = [], isLoading: projectsLoading} = useApiQuery<Project[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/projects/', {
        path: {organizationIdOrSlug: selectedOrgSlug ?? ''},
      }),
    ],
    {staleTime: Infinity, enabled: !!selectedOrgSlug && needProject}
  );

  const projects = useMemo(() => {
    if (!projectSlugs?.length) {
      return rawProjects;
    }
    const slugSet = new Set(projectSlugs);
    return rawProjects.filter(p => slugSet.has(p.slug));
  }, [rawProjects, projectSlugs]);

  const {data: teams = [], isLoading: teamsLoading} = useApiQuery<Team[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/teams/', {
        path: {organizationIdOrSlug: selectedOrgSlug ?? ''},
      }),
    ],
    {staleTime: Infinity, enabled: !!selectedOrgSlug && needTeam}
  );

  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string | null>(null);
  const [selectedTeamSlug, setSelectedTeamSlug] = useState<string | null>(null);

  // --- Auto-navigate logic ---
  const onFinishTimeoutRef = useRef<number | undefined>(undefined);

  const onFinishRef = useRef(onFinish);
  const nextPathRef = useRef(nextPath);
  useEffect(() => {
    onFinishRef.current = onFinish;
    nextPathRef.current = nextPath;
  });

  useEffect(() => {
    return () => window.clearTimeout(onFinishTimeoutRef.current);
  }, []);

  const navigateFinish = useCallback(
    (
      org: string,
      projectSlug: string | undefined | null,
      teamSlug: string | undefined | null
    ) => {
      const np = nextPathRef.current;
      const pathname = typeof np === 'string' ? np : np.pathname;
      const newPathname = replaceRouterParams(pathname, {
        orgId: org,
        projectId: projectSlug ?? undefined,
        project: projects.find(p => p.slug === projectSlug)?.id,
        teamId: teamSlug ?? undefined,
      });
      window.clearTimeout(onFinishTimeoutRef.current);
      onFinishTimeoutRef.current =
        onFinishRef.current(
          typeof np === 'string' ? newPathname : {...np, pathname: newPathname}
        ) ?? undefined;
    },
    [projects]
  );

  // Auto-navigate when all required context is unambiguous
  useEffect(() => {
    // If we only need an org and there are multiple, bail
    if (!needProject && !needTeam && organizations.length !== 1) {
      return;
    }
    if (needProject && projects.length !== 1) {
      return;
    }
    if (needTeam && teams.length !== 1) {
      return;
    }

    const org =
      selectedOrgSlug ??
      (organizations.length === 1 ? organizations[0]!.slug : undefined);
    if (!org) {
      return;
    }

    // All context resolved — navigate
    navigateFinish(
      org,
      needProject ? projects[0]?.slug : undefined,
      needTeam ? teams[0]?.slug : undefined
    );
  }, [
    organizations,
    selectedOrgSlug,
    projects,
    teams,
    needProject,
    needTeam,
    navigateFinish,
  ]);

  // --- Selection handlers ---
  function handleSelectOrganization({value}: {value: string}) {
    if (!needProject && !needTeam) {
      // Only org needed — navigate directly
      navigateFinish(value, undefined, undefined);
      return;
    }
    setSelectedOrgSlug(value);
  }

  function handleSelectProject({value}: {value: string}) {
    if (!value || !selectedOrgSlug) {
      return;
    }
    setSelectedProjectSlug(value);
    if (needTeam && !selectedTeamSlug) {
      return; // wait for team
    }
    navigateFinish(selectedOrgSlug, value, selectedTeamSlug);
  }

  function handleSelectTeam({value}: {value: string}) {
    if (!value || !selectedOrgSlug) {
      return;
    }
    setSelectedTeamSlug(value);
    if (needProject && !selectedProjectSlug) {
      return; // wait for project
    }
    navigateFinish(selectedOrgSlug, selectedProjectSlug, value);
  }

  // --- Header text ---
  function getHeaderText(): string {
    if (needOrg && needProject) {
      return t('Select an organization and a project to continue');
    }
    if (needOrg && needTeam) {
      return t('Select an organization and a team to continue');
    }
    if (needOrg) {
      return t('Select an organization to continue');
    }
    if (needTeam) {
      return t('Select a team to continue');
    }
    if (needProject) {
      return t('Select a project to continue');
    }
    return '';
  }

  // --- Render helpers ---
  const shouldShowProjectSelector = !!selectedOrgSlug && needProject;
  const shouldShowTeamSelector = !!selectedOrgSlug && needTeam;
  // suppress org auto-focus when there's a downstream selector
  const hasDownstreamSelector = shouldShowProjectSelector || shouldShowTeamSelector;

  const shouldShowPicker = needOrg || needProject || needTeam;

  if (!shouldShowPicker) {
    return null;
  }

  const orgChoices = organizations
    .filter(({status}) => status.id !== 'pending_deletion')
    .map(({slug}) => ({label: slug, value: slug}));

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h5">{getHeaderText()}</Heading>
      </Header>
      <Body>
        <Stack gap="md">
          {needOrg && (
            <Select
              ref={hasDownstreamSelector ? undefined : autoFocusReactSelect}
              placeholder={t('Select an Organization')}
              name="organization"
              options={orgChoices}
              value={selectedOrgSlug}
              onChange={handleSelectOrganization}
              components={{DropdownIndicator: null}}
              styles={selectStyles}
              menuIsOpen
            />
          )}

          {shouldShowProjectSelector && (
            <ProjectSelector
              projects={projects}
              projectsLoading={projectsLoading}
              allowAllProjectsSelection={allowAllProjectsSelection}
              onSelectProject={handleSelectProject}
              autoFocus
            />
          )}

          {shouldShowTeamSelector && (
            <TeamSelector
              teams={teams}
              teamsLoading={teamsLoading}
              onSelectTeam={handleSelectTeam}
              autoFocus={!shouldShowProjectSelector}
            />
          )}
        </Stack>
      </Body>
    </Fragment>
  );
}

function ProjectSelector({
  projects,
  projectsLoading,
  allowAllProjectsSelection,
  onSelectProject,
  autoFocus,
}: {
  autoFocus: boolean;
  onSelectProject: (option: {value: string}) => void;
  projects: Project[];
  projectsLoading: boolean;
  allowAllProjectsSelection?: boolean;
}) {
  if (projectsLoading) {
    return (
      <Flex justify="center" align="center" minHeight="345px">
        <LoadingIndicator />
      </Flex>
    );
  }

  const {isSuperuser} = ConfigStore.get('user') || {};
  const {organization} = OrganizationStore.getState();

  const memberProjects: Project[] = [];
  const nonMemberProjects: Project[] = [];
  for (const p of projects) {
    if (p.isMember) {
      memberProjects.push(p);
    } else {
      nonMemberProjects.push(p);
    }
  }

  if (!projects.length && organization) {
    return (
      <div>
        {tct('You have no projects. Click [link] to make one.', {
          link: (
            <Link to={makeProjectsPathname({path: '/new/', organization})}>
              {t('here')}
            </Link>
          ),
        })}
      </div>
    );
  }

  const projectOptions = [
    {
      label: t('My Projects'),
      options: memberProjects.map(p => ({
        value: p.slug,
        label: p.slug,
        disabled: false,
        leadingItems: <ProjectAvatar project={p} size={20} />,
      })),
    },
    {
      label: t('All Projects'),
      options: nonMemberProjects.map(p => ({
        value: p.slug,
        label: p.slug,
        disabled: allowAllProjectsSelection ? false : !isSuperuser,
        leadingItems: <ProjectAvatar project={p} size={20} />,
      })),
    },
  ];

  return (
    <Select
      ref={autoFocus ? autoFocusReactSelect : undefined}
      placeholder={t('Select a Project to continue')}
      name="project"
      options={projectOptions}
      onChange={onSelectProject}
      components={{DropdownIndicator: null}}
      styles={selectStyles}
      menuIsOpen
    />
  );
}

function TeamSelector({
  teams,
  teamsLoading,
  onSelectTeam,
  autoFocus,
}: {
  autoFocus: boolean;
  onSelectTeam: (option: {value: string}) => void;
  teams: Team[];
  teamsLoading: boolean;
}) {
  if (teamsLoading) {
    return (
      <Flex justify="center" align="center" minHeight="345px">
        <LoadingIndicator />
      </Flex>
    );
  }

  if (!teams.length) {
    return <div>{t('No teams found.')}</div>;
  }

  const options = teams.map(team => ({
    value: team.slug,
    label: `#${team.slug}`,
    leadingItems: <TeamAvatar team={team} size={20} />,
  }));

  return (
    <Select
      ref={autoFocus ? autoFocusReactSelect : undefined}
      placeholder={t('Select a Team to continue')}
      name="team"
      options={options}
      onChange={onSelectTeam}
      components={{DropdownIndicator: null}}
      styles={selectStyles}
      menuIsOpen
    />
  );
}

function ConfigUrlContainer(
  props: SharedProps & {
    configQueryKey: ApiQueryKey;
    organizations: Organization[];
    selectedOrgSlug: string | undefined;
    setSelectedOrgSlug: Dispatch<SetStateAction<string | undefined>>;
  }
) {
  const {
    configQueryKey,
    organizations,
    selectedOrgSlug,
    setSelectedOrgSlug,
    ...sharedProps
  } = props;

  const {data, isError, isPending, refetch} = useApiQuery<Integration[]>(configQueryKey, {
    staleTime: Infinity,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }
  if (!data.length) {
    sharedProps.onFinish(sharedProps.nextPath);
  }

  return (
    <ConfigPickerContent
      {...sharedProps}
      organizations={organizations}
      selectedOrgSlug={selectedOrgSlug}
      setSelectedOrgSlug={setSelectedOrgSlug}
      integrationConfigs={data}
    />
  );
}

function ConfigPickerContent({
  organizations,
  selectedOrgSlug,
  setSelectedOrgSlug,
  integrationConfigs,
  needOrg,
  nextPath,
  onFinish,
  Header,
  Body,
}: SharedProps & {
  integrationConfigs: Integration[];
  organizations: Organization[];
  selectedOrgSlug: string | undefined;
  setSelectedOrgSlug: Dispatch<SetStateAction<string | undefined>>;
}) {
  const {isSuperuser} = ConfigStore.get('user') || {};
  const shouldShowConfigSelector = integrationConfigs.length > 0 && isSuperuser;

  function handleSelectOrganization({value}: {value: string}) {
    setSelectedOrgSlug(value);
  }

  function handleSelectConfiguration({value}: {value: string}) {
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
  }

  const orgChoices = organizations
    .filter(({status}) => status.id !== 'pending_deletion')
    .map(({slug}) => ({label: slug, value: slug}));

  if (!needOrg && !shouldShowConfigSelector) {
    return null;
  }

  const headerText = shouldShowConfigSelector
    ? t('Select a configuration to continue')
    : t('Select an organization to continue');

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h5">{headerText}</Heading>
      </Header>
      <Body>
        <Stack gap="md">
          {needOrg && (
            <Select
              ref={shouldShowConfigSelector ? undefined : autoFocusReactSelect}
              placeholder={t('Select an Organization')}
              name="organization"
              options={orgChoices}
              value={selectedOrgSlug}
              onChange={handleSelectOrganization}
              components={{DropdownIndicator: null}}
              styles={selectStyles}
              menuIsOpen
            />
          )}

          {shouldShowConfigSelector && (
            <Select
              ref={autoFocusReactSelect}
              placeholder={t('Select a configuration to continue')}
              name="configurations"
              options={[
                {
                  label: tct('[providerName] Configurations', {
                    providerName: integrationConfigs[0]!.provider.name,
                  }),
                  options: integrationConfigs.map(config => ({
                    value: config.id,
                    label: (
                      <Grid columns="32px auto" rows="1fr">
                        <IntegrationIcon size={22} integration={config} />
                        <span>{config.domainName}</span>
                      </Grid>
                    ),
                    disabled: !isSuperuser,
                  })),
                },
              ]}
              onChange={handleSelectConfiguration}
              components={{DropdownIndicator: null}}
              styles={selectStyles}
              menuIsOpen
            />
          )}
        </Stack>
      </Body>
    </Fragment>
  );
}

export default function ContextPickerModalContainer({
  configQueryKey,
  projectSlugs,
  ...sharedProps
}: ContainerProps) {
  const {organizations} = useLegacyStore(OrganizationsStore);
  const {organization} = useLegacyStore(OrganizationStore);
  const [selectedOrgSlug, setSelectedOrgSlug] = useState(organization?.slug);

  if (configQueryKey) {
    return (
      <ConfigUrlContainer
        configQueryKey={configQueryKey}
        organizations={organizations}
        selectedOrgSlug={selectedOrgSlug}
        setSelectedOrgSlug={setSelectedOrgSlug}
        {...sharedProps}
      />
    );
  }

  return (
    <ContextPickerContent
      key={selectedOrgSlug}
      organizations={organizations}
      selectedOrgSlug={selectedOrgSlug}
      setSelectedOrgSlug={setSelectedOrgSlug}
      projectSlugs={projectSlugs}
      {...sharedProps}
    />
  );
}
