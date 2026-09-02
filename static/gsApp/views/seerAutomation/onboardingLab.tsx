import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import {useInfiniteQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';
import {NoAccess} from 'sentry/components/noAccess';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {
  SEER_ONBOARDING_SCENARIOS,
  getSeerOnboardingScenario,
} from 'sentry/components/seer/onboarding/scenarios';
import {SeerOnboardingModal} from 'sentry/components/seer/onboarding/seerOnboardingModal';
import type {
  SeerOnboardingActions,
  SeerOnboardingState,
} from 'sentry/components/seer/onboarding/types';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {NODE_ENV} from 'sentry/constants/env';
import {t} from 'sentry/locale';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {GithubButton} from 'getsentry/views/seerAutomation/onboarding/githubButton';
import {SeerOnboardingProvider} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';

/** Monotonic so a removed row's id is never reused within a session. */
let nextLinkId = 1000;

const modalCss = css`
  width: 100%;
  max-width: 640px;
`;

type ScmMode = 'standin' | 'real';
type DataSource = 'live' | 'fixtures';

/**
 * Stands in for the GitHub install pipeline.
 *
 * The real flow calls `openPipelineModal`, and `GlobalModal` is a singleton — so
 * launching it *replaces* the onboarding modal rather than stacking on it. This
 * reproduces exactly that takeover, so the hand-back can be exercised without
 * installing a GitHub app anywhere.
 */
function StandInPipelineModal({
  Header,
  Body,
  Footer,
  closeModal,
  onComplete,
}: ModalRenderProps & {
  onComplete: () => void;
}) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h2" size="lg">
          {t('Add Installation')}
        </Heading>
      </Header>
      <Body>
        <Stack gap="md">
          <Text variant="muted">
            {t(
              'Stand-in for the GitHub install pipeline. The real one OAuths in a popup and asks which GitHub organization to install into.'
            )}
          </Text>
          <Text variant="muted">
            {t(
              'Note that this modal replaced the onboarding modal — finishing here should hand you back to it.'
            )}
          </Text>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => {
              closeModal();
              onComplete();
            }}
          >
            {t('Finish install')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

/**
 * Owns the mock state for one run through the modal.
 *
 * This has to live inside the modal renderer: `GlobalModal` keeps the renderer in
 * a store, so a closure over the lab page's state would go stale as soon as the
 * first action fired. `onStateChange` mirrors the state back out so the lab's
 * state table survives the modal being torn down by the install pipeline.
 */
function MockSeerOnboardingModal({
  initialState,
  onStateChange,
  scmButton,
  ...modalProps
}: ModalRenderProps & {
  initialState: SeerOnboardingState;
  onStateChange: (state: SeerOnboardingState) => void;
  scmButton: React.ReactNode;
}) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    onStateChange(state);
  }, [state, onStateChange]);

  const actions = useMemo<SeerOnboardingActions>(
    () => ({
      // Stands in for checkout: the org comes back with a plan and budget.
      activateSeer: () =>
        setState(prev => ({...prev, entitlement: 'seat-based', hasAutofixBudget: true})),
      // Unused here — the SCM step renders a real launcher via `scmButton`.
      connectScm: () => setState(prev => ({...prev, hasSupportedScmIntegration: true})),
      enableAiFeatures: () => setState(prev => ({...prev, hideAiFeatures: false})),
      addRepoLink: () =>
        setState(prev => ({
          ...prev,
          repoLinks: [
            ...prev.repoLinks,
            {id: `link-${nextLinkId++}`, repoId: '', projectId: ''},
          ],
        })),
      removeRepoLink: linkId =>
        setState(prev => ({
          ...prev,
          repoLinks: prev.repoLinks.filter(link => link.id !== linkId),
        })),
      setLinkRepo: (linkId, repoId) =>
        setState(prev => ({
          ...prev,
          repoLinks: prev.repoLinks.map(link =>
            link.id === linkId ? {...link, repoId} : link
          ),
        })),
      setLinkProject: (linkId, projectId) =>
        setState(prev => ({
          ...prev,
          repoLinks: prev.repoLinks.map(link =>
            link.id === linkId ? {...link, projectId} : link
          ),
          // A newly attached project starts from the org default, which is off.
          stoppingPoints: {[projectId]: 'off', ...prev.stoppingPoints},
        })),
      setProjectStoppingPoint: (projectId, value) =>
        setState(prev => ({
          ...prev,
          stoppingPoints: {...prev.stoppingPoints, [projectId]: value},
        })),
      setEnableSeerCoding: value =>
        setState(prev => ({...prev, enableSeerCoding: value})),
    }),
    []
  );

  return (
    <SeerOnboardingModal
      {...modalProps}
      state={state}
      actions={actions}
      scmButton={scmButton}
    />
  );
}

/**
 * The gates worth watching, in the order the modal walks them. The repo/project
 * catalogue is source data, not state, so it is left out.
 */
function describeState(state: SeerOnboardingState): Array<[string, string]> {
  const repoLinks =
    state.repoLinks.length === 0
      ? '[]'
      : state.repoLinks
          .map(link => {
            const repo =
              state.availableRepos.find(r => r.id === link.repoId)?.name ?? '?';
            const project =
              state.availableProjects.find(p => p.id === link.projectId)?.slug ?? '?';
            return `${repo} → ${project}`;
          })
          .join(', ');

  const stoppingPoints = Object.entries(state.stoppingPoints);

  return [
    ['entitlement', state.entitlement],
    ['hasAutofixBudget', String(state.hasAutofixBudget)],
    ['hideAiFeatures', String(state.hideAiFeatures)],
    ['canWriteOrgSettings', String(state.canWriteOrgSettings)],
    ['hasSupportedScmIntegration', String(state.hasSupportedScmIntegration)],
    ['hasScmWriteAccess', String(state.hasScmWriteAccess)],
    ['repoLinks', repoLinks],
    [
      'stoppingPoints',
      stoppingPoints.length === 0
        ? '{}'
        : stoppingPoints
            .map(([projectId, value]) => {
              const slug =
                state.availableProjects.find(p => p.id === projectId)?.slug ?? projectId;
              return `${slug}: ${value}`;
            })
            .join(', '),
    ],
    ['enableSeerCoding', String(state.enableSeerCoding)],
    ['isCodingSettingManaged', String(state.isCodingSettingManaged)],
  ];
}

function StateRow({label, value}: {label: string; value: string}) {
  return (
    <PanelItem>
      <Grid columns="220px 1fr" gap="md" width="100%">
        <Text size="sm" variant="muted" monospace>
          {label}
        </Text>
        <Text size="sm" monospace data-test-id={`lab-state-${label}`}>
          {value}
        </Text>
      </Grid>
    </PanelItem>
  );
}

/**
 * Rehomes a scenario's fixture links onto whatever this organization actually
 * has, pairing them off by position. Links and stopping points beyond the real
 * catalogue are dropped rather than left dangling.
 */
function withLiveCatalogue(
  scenarioState: SeerOnboardingState,
  availableRepos: SeerOnboardingState['availableRepos'],
  availableProjects: SeerOnboardingState['availableProjects']
): SeerOnboardingState {
  const fixtureProjectIds = scenarioState.availableProjects.map(p => p.id);

  const repoLinks = scenarioState.repoLinks
    .map((link, index) => {
      const repo = availableRepos[index];
      const projectIndex = fixtureProjectIds.indexOf(link.projectId);
      const project = projectIndex >= 0 ? availableProjects[projectIndex] : undefined;
      if (!repo) {
        return null;
      }
      return {
        id: link.id,
        repoId: link.repoId ? repo.id : '',
        // Preserve a half-filled row as half-filled.
        projectId: link.projectId ? (project?.id ?? '') : '',
      };
    })
    .filter(link => link !== null);

  const stoppingPoints = Object.fromEntries(
    Object.entries(scenarioState.stoppingPoints).flatMap(([fixtureId, value]) => {
      const project = availableProjects[fixtureProjectIds.indexOf(fixtureId)];
      return project ? [[project.id, value] as const] : [];
    })
  );

  return {...scenarioState, availableRepos, availableProjects, repoLinks, stoppingPoints};
}

export default function SeerOnboardingLab() {
  const organization = useOrganization();
  const {openModal} = useModal();
  const [scenarioKey, setScenarioKey] = useState(SEER_ONBOARDING_SCENARIOS[0]!.key);
  const [scmMode, setScmMode] = useState<ScmMode>('standin');
  const [dataSource, setDataSource] = useState<DataSource>('live');

  const {projects, fetching: projectsFetching} = useProjects();
  const reposResult = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({
      organization,
      query: {per_page: 100},
      staleTime: 60_000,
    }),
    select: selectUniqueRepos,
  });
  useFetchAllPages({result: reposResult});

  const liveRepos = useMemo(
    () =>
      (reposResult.data ?? [])
        .filter(repo => repo.externalId)
        .map(repo => ({id: repo.id, name: repo.name})),
    [reposResult.data]
  );
  const liveProjects = useMemo(
    () => projects.map(project => ({id: project.id, slug: project.slug})),
    [projects]
  );
  const hasLiveData = liveRepos.length > 0 && liveProjects.length > 0;
  const useLive = dataSource === 'live' && hasLiveData;

  const buildState = useCallback(
    (key: string) => {
      const scenarioState = getSeerOnboardingScenario(key).state;
      return useLive
        ? withLiveCatalogue(scenarioState, liveRepos, liveProjects)
        : scenarioState;
    },
    [liveProjects, liveRepos, useLive]
  );

  const [liveState, setLiveState] = useState(
    () => getSeerOnboardingScenario(SEER_ONBOARDING_SCENARIOS[0]!.key).state
  );

  const selectScenario = useCallback(
    (key: string) => {
      setScenarioKey(key);
      setLiveState(buildState(key));
    },
    [buildState]
  );

  // Re-seed when the catalogue arrives or the source is switched, so the table
  // and the modal never disagree about which repos exist.
  const lastSourceRef = useRef(useLive);
  useEffect(() => {
    if (lastSourceRef.current !== useLive) {
      lastSourceRef.current = useLive;
      setLiveState(buildState(scenarioKey));
    }
  }, [buildState, scenarioKey, useLive]);

  // The install pipeline tears our modal down, so re-opening has to reach the
  // freshest state and opener rather than whatever the old closure captured.
  // Written in an effect below, never during render.
  const openRef = useRef<(state: SeerOnboardingState) => void>(() => {});

  const openWithState = (state: SeerOnboardingState) => {
    const handleScmConnected = () => {
      const next = {...state, hasSupportedScmIntegration: true};
      setLiveState(next);
      openRef.current(next);
    };

    const scmButton =
      scmMode === 'real' ? (
        <SeerOnboardingProvider>
          <GithubButton
            onAddIntegration={handleScmConnected}
            analyticsView="seer_onboarding_github"
          />
        </SeerOnboardingProvider>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            openModal(deps => (
              <StandInPipelineModal {...deps} onComplete={handleScmConnected} />
            ))
          }
        >
          {t('Connect GitHub')}
        </Button>
      );

    openModal(
      deps => (
        <MockSeerOnboardingModal
          {...deps}
          initialState={state}
          onStateChange={setLiveState}
          scmButton={scmButton}
        />
      ),
      {closeEvents: 'escape-key', modalCss}
    );
  };

  useEffect(() => {
    openRef.current = openWithState;
  });

  // `org:superuser` is only granted while superuser mode is active, so this keeps
  // the page to employees in production while staying available in local dev.
  const isSuperuser = organization.access.includes('org:superuser');
  if (!isSuperuser && NODE_ENV !== 'development') {
    return <NoAccess />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Seer Onboarding Lab')} />
      <SettingsPageHeader
        title={t('Seer Onboarding Lab')}
        subtitle={t(
          'Drive the Seer Autofix onboarding modal through every state a real organization can be in. Selections are simulated and never written back, but the repository and project lists are this organization’s real ones.'
        )}
      />

      <Grid columns={{'screen:xs': '1fr', 'screen:lg': '360px 1fr'}} gap="2xl">
        <Stack gap="xl">
          <Panel>
            <PanelHeader>{t('Scenario')}</PanelHeader>
            <PanelBody withPadding>
              <RadioGroup
                label={t('Scenario')}
                value={scenarioKey}
                choices={SEER_ONBOARDING_SCENARIOS.map(
                  ({key, label, description}) => [key, label, description] as const
                )}
                onChange={selectScenario}
              />
            </PanelBody>
          </Panel>

          <Flex gap="md">
            <Button variant="primary" onClick={() => openWithState(liveState)}>
              {t('Open modal')}
            </Button>
            <Button onClick={() => selectScenario(scenarioKey)}>{t('Reset')}</Button>
          </Flex>
        </Stack>

        <Stack gap="xl">
          <Panel>
            <PanelHeader>{t('Mock state')}</PanelHeader>
            <PanelBody>
              {describeState(liveState).map(([label, value]) => (
                <StateRow key={label} label={label} value={value} />
              ))}
            </PanelBody>
          </Panel>

          <Stack gap="md">
            <Heading as="h3" size="sm">
              {t('Repositories and projects')}
            </Heading>
            <SegmentedControl
              size="sm"
              value={dataSource}
              onChange={value => setDataSource(value)}
            >
              <SegmentedControl.Item key="live">
                {t(
                  'This org (%s repos, %s projects)',
                  liveRepos.length,
                  liveProjects.length
                )}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="fixtures">
                {t('Fixtures')}
              </SegmentedControl.Item>
            </SegmentedControl>
            {dataSource === 'live' && !hasLiveData ? (
              <Text size="sm" variant="warning">
                {projectsFetching || reposResult.isFetching
                  ? t('Loading this organization’s repositories and projects…')
                  : t(
                      'This organization has no connected repositories, so the fixture catalogue is being used instead.'
                    )}
              </Text>
            ) : null}

            <Heading as="h3" size="sm">
              {t('GitHub connection')}
            </Heading>
            <SegmentedControl
              size="sm"
              value={scmMode}
              onChange={value => setScmMode(value)}
            >
              <SegmentedControl.Item key="standin">{t('Stand-in')}</SegmentedControl.Item>
              <SegmentedControl.Item key="real">
                {t('Real install')}
              </SegmentedControl.Item>
            </SegmentedControl>
            <Text size="sm" variant="muted">
              {scmMode === 'real'
                ? t(
                    'Uses the real GithubButton and launches the real install pipeline. This installs the GitHub app on this organization for real.'
                  )
                : t(
                    'Reproduces the modal takeover and hand-back without installing anything.'
                  )}
            </Text>
          </Stack>

          <Stack gap="md">
            <Heading as="h3" size="sm" variant="muted">
              {t('About this scenario')}
            </Heading>
            <Text variant="muted">
              {getSeerOnboardingScenario(scenarioKey).description}
            </Text>
          </Stack>
        </Stack>
      </Grid>
    </Fragment>
  );
}
