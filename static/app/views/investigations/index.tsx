import styled from '@emotion/styled';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconStar} from '@sentry/icons/star';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {UserAvatar} from '@sentry/scraps/avatar';
import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {openConfirmModal} from '@sentry/scraps/confirm';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {COL_WIDTH_UNDEFINED} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {Feature} from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {DataGrid, type GridColumnOrder} from 'sentry/components/tables/dataGrid';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getPaginationProps} from 'sentry/utils/pagination';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {RouteError} from 'sentry/views/routeError';
import {getStrategyLabel} from 'sentry/views/seerWorkflows/strategies';
import {
  getAutomationDetailPath,
  useAutomationsEnabled,
} from 'sentry/views/seerWorkflows/utils';

import {
  getInvestigationDetailQueryOptions,
  investigationListQueryOptions,
  useDeleteInvestigationMutation,
  useDuplicateInvestigationMutation,
  useSetInvestigationFavoriteMutation,
} from './api';
import {updateInvestigationCache} from './investigationCache';
import type {InvestigationListItem, InvestigationTrigger} from './types';
import {getActorName, getInvestigationPath, useInvestigationsEnabled} from './utils';

enum ColumnKey {
  NAME = 'title',
  TRIGGER = 'trigger',
  CREATED = 'dateCreated',
  STATUS = 'status',
  ACTIONS = 'actions',
}

const COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: ColumnKey.NAME, name: t('Name'), width: COL_WIDTH_UNDEFINED},
  {key: ColumnKey.TRIGGER, name: t('Trigger'), width: 260},
  {key: ColumnKey.CREATED, name: t('Created'), width: 160},
  {key: ColumnKey.STATUS, name: t('Status'), width: 160},
  {key: ColumnKey.ACTIONS, name: '', width: 40},
];

const TableWrapper = styled('div')`
  table {
    grid-template-columns: max-content minmax(240px, 1fr) 260px 160px 160px max-content !important;
  }
`;

function getStatusLabel({orchestration}: InvestigationListItem) {
  // Manual investigations have no run, and Seer can add statuses we don't know yet.
  switch (orchestration?.status) {
    case 'pending':
      return t('Queued');
    case 'processing':
      return t('Running');
    case 'awaiting_input':
      return t('Needs input');
    case 'completed':
      return t('Completed');
    case 'failed':
      return t('Failed');
    case 'cancelled':
      return t('Cancelled');
    default:
      return t('Active');
  }
}

function isRunActive(investigation: InvestigationListItem) {
  return ['pending', 'processing'].includes(investigation.orchestration?.status ?? '');
}

function TriggerCell({trigger}: {trigger: InvestigationTrigger}) {
  const organization = useOrganization();
  const automationsEnabled = useAutomationsEnabled();

  if (trigger.type === 'user') {
    return (
      <Flex align="center" gap="sm" minWidth={0}>
        <UserAvatar user={trigger.user} size={16} />
        <Text ellipsis>{getActorName(trigger.user)}</Text>
      </Flex>
    );
  }

  const label = t(
    '%s · Run %s',
    trigger.automation.name ?? getStrategyLabel(trigger.automation.strategy),
    trigger.runId
  );
  return (
    <Text ellipsis>
      {automationsEnabled ? (
        <TriggerLink
          to={`${getAutomationDetailPath(organization.slug, trigger.automation.id)}runs/`}
        >
          {label}
        </TriggerLink>
      ) : (
        label
      )}
    </Text>
  );
}

// Links to other objects in a list row use primary text and underline on hover,
// like the Monitors list's issue cells.
const TriggerLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};

  &:hover,
  &:focus-visible {
    color: ${p => p.theme.tokens.content.primary};
    text-decoration: underline;
  }
`;

function InvestigationActions({
  investigation,
  onCopy,
  onDelete,
  onDuplicate,
}: {
  investigation: InvestigationListItem;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <DropdownMenu
      items={[
        {
          key: 'copy-link',
          label: t('Copy link'),
          onAction: onCopy,
        },
        {
          key: 'duplicate',
          label: t('Duplicate'),
          onAction: onDuplicate,
        },
        {
          key: 'delete',
          label: t('Delete'),
          priority: 'danger',
          onAction: () =>
            openConfirmModal({
              message: t('Are you sure you want to delete this investigation?'),
              priority: 'danger',
              confirmText: t('Delete'),
              onConfirm: onDelete,
            }),
        },
      ]}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="sm"
          variant="transparent"
          icon={<IconEllipsis />}
          aria-label={t('More options for %s', investigation.title)}
        />
      )}
      position="bottom-end"
      usePortal
    />
  );
}

function FeatureDisabledPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <FeatureDisabled
        features="organizations:investigations"
        featureName={t('Investigations')}
      />
    </Stack>
  );
}

function ClosedMembershipPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning">
          {t('Investigations are only available to organizations with open membership.')}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}

export function InvestigationsPage() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {copy} = useCopyToClipboard();
  const [{query, cursor}, setQueryParams] = useQueryStates({
    query: parseAsString,
    cursor: parseAsString,
  });

  const listOptions = investigationListQueryOptions({
    organizationSlug: organization.slug,
    query: query ?? undefined,
    cursor: cursor ?? undefined,
  });
  const {data, isPending, isError, error} = useQuery({
    ...listOptions,
    select: selectJsonWithHeaders,
    refetchInterval: queryState => {
      const items = queryState.state.data?.json ?? [];
      if (
        items.some(item =>
          ['pending', 'running'].includes(item.titleGeneration?.status ?? '')
        )
      ) {
        return 2000;
      }
      return items.some(isRunActive) ? 10_000 : false;
    },
  });

  const favoriteMutation = useSetInvestigationFavoriteMutation(organization.slug, {
    onSuccess: (_data, {investigation, shouldFavorite}) => {
      updateInvestigationCache(
        queryClient,
        organization.slug,
        investigation.id,
        current => ({...current, isFavorited: shouldFavorite})
      );
      toast.success(t('Investigation favorite updated.'));
    },
    onError: () => toast.error(t('Unable to update investigation favorite.')),
  });

  const duplicateMutation = useDuplicateInvestigationMutation(organization.slug, {
    onSuccess: () => toast.success(t('Investigation duplicated.')),
    onError: () => toast.error(t('Unable to duplicate investigation.')),
  });

  const deleteMutation = useDeleteInvestigationMutation(organization.slug, {
    onSuccess: (_data, investigation) => {
      queryClient.removeQueries({
        queryKey: getInvestigationDetailQueryOptions(organization.slug, investigation.id)
          .queryKey,
        exact: true,
      });
      toast.success(t('Investigation deleted.'));
    },
    onError: () => toast.error(t('Unable to delete investigation.')),
  });

  function handleSearch(nextQuery: string) {
    setQueryParams({
      query: nextQuery || null,
      cursor: null,
    });
  }

  const renderBodyCell = (
    column: GridColumnOrder<ColumnKey>,
    investigation: InvestigationListItem
  ) => {
    switch (column.key) {
      case ColumnKey.NAME:
        return (
          <Text ellipsis>
            <Link
              to={getInvestigationPath(organization.slug, investigation.id)}
              onClick={() =>
                void queryClient.prefetchQuery(
                  getInvestigationDetailQueryOptions(organization.slug, investigation.id)
                )
              }
            >
              {investigation.title}
            </Link>
          </Text>
        );
      case ColumnKey.TRIGGER:
        return investigation.trigger ? (
          <TriggerCell trigger={investigation.trigger} />
        ) : null;
      case ColumnKey.CREATED:
        return <TimeSince date={investigation.dateCreated} />;
      case ColumnKey.STATUS:
        return getStatusLabel(investigation);
      case ColumnKey.ACTIONS:
        return (
          <InvestigationActions
            investigation={investigation}
            onCopy={() =>
              copy(
                `${window.location.origin}${getInvestigationPath(
                  organization.slug,
                  investigation.id
                )}`,
                {successMessage: t('Investigation link copied.')}
              )
            }
            onDuplicate={() => duplicateMutation.mutate(investigation)}
            onDelete={() => deleteMutation.mutate(investigation)}
          />
        );
      default:
        return null;
    }
  };

  const investigations = data?.json ?? [];

  return (
    <SentryDocumentTitle title={t('Investigations')} orgSlug={organization.slug}>
      <ErrorBoundary>
        {isError ? (
          <Stack flex={1} padding="2xl 3xl">
            <RouteError error={error} />
          </Stack>
        ) : (
          <Stack flex={1}>
            <TopBar.Slot
              name="breadcrumbs"
              title={{
                type: 'page-title',
                label: t('Investigations'),
                trailingActions: {type: 'badge', element: <FeatureBadge type="alpha" />},
              }}
            />
            <Layout.Body>
              <Layout.Main width="full">
                <Grid
                  columns={{zero: 'auto', xl: 'auto max-content'}}
                  gap="md"
                  marginBottom="xl"
                >
                  <SearchBar
                    query={query ?? ''}
                    placeholder={t('Search Investigations')}
                    onSearch={handleSearch}
                  />
                  <CompactSelect
                    trigger={triggerProps => (
                      <OverlayTrigger.Button {...triggerProps} prefix={t('Sort By')} />
                    )}
                    value="recentActivity"
                    options={[{label: t('Recent Activity'), value: 'recentActivity'}]}
                    onChange={() => null}
                    position="bottom-end"
                    data-test-id="investigations-sort"
                  />
                </Grid>
                <TableWrapper>
                  <DataGrid
                    data={investigations}
                    columnOrder={COLUMNS}
                    grid={{
                      renderBodyCell,
                      renderPrependColumns: (isHeader, investigation) => {
                        if (isHeader) {
                          return [
                            <IconStar
                              key="favorite-header"
                              variant="warning"
                              isSolid
                              aria-label={t('Favorite')}
                            />,
                          ];
                        }
                        if (!investigation) {
                          return [];
                        }
                        return [
                          <Button
                            key={investigation.id}
                            size="zero"
                            variant="transparent"
                            aria-label={
                              investigation.isFavorited
                                ? t('Unfavorite %s', investigation.title)
                                : t('Favorite %s', investigation.title)
                            }
                            icon={
                              <IconStar
                                size="sm"
                                variant={investigation.isFavorited ? 'warning' : 'muted'}
                                isSolid={investigation.isFavorited}
                              />
                            }
                            onClick={() =>
                              favoriteMutation.mutate({
                                investigation,
                                shouldFavorite: !investigation.isFavorited,
                              })
                            }
                          />,
                        ];
                      },
                      prependColumnWidths: ['max-content'],
                    }}
                    isLoading={isPending}
                    resizable={false}
                    emptyMessage={
                      <EmptyStateWarning>
                        <Text as="p">
                          {t('Sorry, no investigations match your filters.')}
                        </Text>
                      </EmptyStateWarning>
                    }
                  />
                </TableWrapper>
                <Container marginBottom="2xl">
                  <Pagination
                    {...getPaginationProps(data?.headers.Link)}
                    onCursor={(nextCursor, direction) => {
                      const offset = Number(nextCursor?.split?.(':')?.[1] ?? 0);
                      setQueryParams({
                        cursor:
                          direction === -1 && offset <= 0 ? null : (nextCursor ?? null),
                      });
                    }}
                  />
                </Container>
              </Layout.Main>
            </Layout.Body>
          </Stack>
        )}
      </ErrorBoundary>
    </SentryDocumentTitle>
  );
}

export default function InvestigationsView() {
  const organization = useOrganization();
  const investigationsEnabled = useInvestigationsEnabled();

  return (
    <AnalyticsArea name="investigations.list" overrideParent>
      <Feature
        organization={organization}
        features="organizations:investigations"
        renderDisabled={() => <FeatureDisabledPage />}
      >
        {investigationsEnabled ? <InvestigationsPage /> : <ClosedMembershipPage />}
      </Feature>
    </AnalyticsArea>
  );
}
