import {Fragment} from 'react';
import type {Location} from 'history';

import {TeamAvatar} from '@sentry/scraps/avatar';
import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {IdBadge} from 'sentry/components/idBadge';
import {
  Provider as TeamKeyTransactionProvider,
  useTeamKeyTransactions,
} from 'sentry/components/performance/teamKeyTransactionsManager';
import {Placeholder} from 'sentry/components/placeholder';
import {IconCheckmark, IconEllipsis, IconSettings, IconStar} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventView} from 'sentry/utils/discover/eventView';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'sentry/utils/performance/constants';
import {useTeams} from 'sentry/utils/useTeams';
import {TopBar} from 'sentry/views/navigation/topBar';
import {getTransactionSummaryParentCrumbs} from 'sentry/views/performance/breadcrumb';

import type {TransactionThresholdMetric} from './transactionThresholdModal';
import {useEventViewProject} from './useEventViewProject';
import {useTransactionThreshold} from './useTransactionThreshold';

interface TransactionBreadcrumbsProps {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projectId: string;
  projects: Project[];
  transactionName: string;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
}

interface ContentProps extends TransactionBreadcrumbsProps {
  /**
   * Whether `useTeams` has finished loading the viewer's teams. TeamStore is
   * global and often already holds teams loaded elsewhere, so a non-empty list
   * is not on its own a complete one.
   */
  areTeamsLoaded: boolean;
}

interface StarForTeamItemProps {
  areTeamsLoaded: boolean;
  eventView: EventView;
  organization: Organization;
  projects: Project[];
  transactionName: string;
}

/**
 * The "Star for Team" entry of the page-title menu: a submenu of the viewer's
 * teams on this project, each toggling whether the transaction is keyed for
 * them. Renders disabled — without a submenu — whenever there is nothing to
 * toggle, which covers teams or key transactions still loading, a failed
 * fetch, a multi-project view, and a project the viewer shares no team with.
 */
function useStarForTeamItem({
  areTeamsLoaded,
  eventView,
  organization,
  projects,
  transactionName,
}: StarForTeamItemProps): MenuItemProps {
  const {counts, error, getKeyedTeams, handleToggleKeyTransaction, isLoading, teams} =
    useTeamKeyTransactions();

  // Keying targets one project, so anything but a single-project view is inert.
  const isSingleProject = eventView.project.length === 1;
  const project = useEventViewProject(projects, eventView);
  const keyedTeams =
    isSingleProject && project ? getKeyedTeams(project.id, transactionName) : null;
  const keyedTeamsCount = keyedTeams?.size ?? 0;

  const item = {
    key: 'star-for-team',
    label: keyedTeamsCount
      ? tn('Starred for Team', 'Starred for Teams', keyedTeamsCount)
      : t('Star for Team'),
    leadingItems: (
      <IconStar
        isSolid={!!keyedTeamsCount}
        variant={keyedTeamsCount ? 'warning' : 'muted'}
      />
    ),
  } satisfies MenuItemProps;

  if (!areTeamsLoaded || !isSingleProject || !project || isLoading || error) {
    return {...item, disabled: true};
  }

  const projectTeamIds = new Set(project.teams.map(({id}) => id));
  const projectTeams = teams.filter(team => projectTeamIds.has(team.id));

  const toTeamItem = (team: (typeof projectTeams)[number]): MenuItemProps => {
    const isKeyed = !!keyedTeams?.has(team.id);
    // A team can only key so many transactions; already-keyed ones stay
    // toggleable so the viewer can always unstar.
    const isAtLimit =
      !isKeyed && (counts?.get(team.id) ?? 0) >= MAX_TEAM_KEY_TRANSACTIONS;

    return {
      key: team.id,
      label: `#${team.slug}`,
      leadingItems: <TeamAvatar size={18} team={team} />,
      trailingItems: isAtLimit ? (
        t('Max %s', MAX_TEAM_KEY_TRANSACTIONS)
      ) : isKeyed ? (
        <IconCheckmark size="xs" />
      ) : undefined,
      disabled: isAtLimit,
      // Starring several teams in a row is the common case.
      closeOnSelect: false,
      onAction: () => {
        const action = isKeyed ? 'unkey' : 'key';
        trackAnalytics('performance_views.team_key_transaction.set', {
          organization,
          action,
        });
        handleToggleKeyTransaction({
          action,
          teamIds: [team.id],
          project,
          transactionName,
        });
      },
    };
  };

  // Teams that have hit their limit sort last — they are the only ones the
  // viewer cannot act on.
  const teamItems = projectTeams.map(toTeamItem);
  const children = [
    ...teamItems.filter(teamItem => !teamItem.disabled),
    ...teamItems.filter(teamItem => teamItem.disabled),
  ];

  if (children.length === 0) {
    return {...item, disabled: true};
  }

  return {...item, submenu: true, children};
}

function TransactionBreadcrumbsContent({
  areTeamsLoaded,
  eventView,
  location,
  organization,
  projectId,
  projects,
  transactionName,
  onChangeThreshold,
}: ContentProps) {
  const starForTeamItem = useStarForTeamItem({
    areTeamsLoaded,
    eventView,
    organization,
    projects,
    transactionName,
  });
  const {isLoading: isThresholdLoading, openThresholdModal} = useTransactionThreshold({
    eventView,
    organization,
    transactionName,
    onChangeThreshold,
  });

  const project = projects.find(p => p.id === projectId);

  const parentItems = getTransactionSummaryParentCrumbs({
    location,
    organization,
    transaction: {name: transactionName, project: projectId},
  }).map(crumb => ({type: 'link' as const, ...crumb}));

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList items={parentItems} />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title
          item={{
            type: 'page-title',
            label: transactionName,
            leadingGraphic: project ? (
              <IdBadge
                project={project}
                avatarSize={16}
                hideName
                avatarProps={{hasTooltip: true, tooltip: project.slug}}
              />
            ) : (
              <Placeholder width="16px" height="16px" />
            ),
            trailingActions: {
              type: 'menu',
              triggerLabel: t('Transaction Actions'),
              triggerIcon: <IconEllipsis />,
              items: [
                starForTeamItem,
                {
                  key: 'set-transaction-threshold',
                  label: t('Transaction Settings'),
                  leadingItems: <IconSettings variant="muted" />,
                  disabled: isThresholdLoading,
                  onAction: openThresholdModal,
                },
              ],
            },
          }}
        />
      </TopBar.Slot>
    </Fragment>
  );
}

/**
 * The transaction summary breadcrumb trail: the parent crumbs, the transaction
 * name as the page title, and the page-level actions menu beside it.
 */
export function TransactionBreadcrumbs(props: TransactionBreadcrumbsProps) {
  const {eventView, organization, projects} = props;
  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});
  const keyTransactionProject = useEventViewProject(projects, eventView);

  // Nothing to key against, so skip the provider and its fetch entirely.
  // Outside it the manager context resolves to its empty default, which is
  // exactly the disabled star state this case should render.
  if (eventView.project.length !== 1 || !keyTransactionProject) {
    return <TransactionBreadcrumbsContent {...props} areTeamsLoaded={initiallyLoaded} />;
  }

  return (
    <TeamKeyTransactionProvider
      organization={organization}
      teams={teams}
      selectedTeams={['myteams']}
      selectedProjects={[keyTransactionProject.id]}
    >
      <TransactionBreadcrumbsContent {...props} areTeamsLoaded={initiallyLoaded} />
    </TeamKeyTransactionProvider>
  );
}
