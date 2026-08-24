import styled from '@emotion/styled';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {parseAsString, useQueryStates} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {SearchBar} from 'sentry/components/searchBar';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconAdd, IconStar} from 'sentry/icons';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  investigationDetailQueryOptions,
  investigationListQueryOptions,
  useCreateInvestigationMutation,
  useDeleteInvestigationMutation,
  useDuplicateInvestigationMutation,
  useSetInvestigationFavoriteMutation,
} from 'sentry/views/investigations/api';
import {updateInvestigationCache} from 'sentry/views/investigations/investigationCache';
import type {InvestigationListItem} from 'sentry/views/investigations/types';
import {RouteError} from 'sentry/views/routeError';

enum ColumnKey {
  NAME = 'title',
  BLOCKS = 'blockCount',
  CREATED = 'dateCreated',
  STATUS = 'status',
  ACTIONS = 'actions',
}

const COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: ColumnKey.NAME, name: t('Name'), width: COL_WIDTH_UNDEFINED},
  {key: ColumnKey.BLOCKS, name: t('Blocks'), width: 116},
  {key: ColumnKey.CREATED, name: t('Created'), width: 160},
  {key: ColumnKey.STATUS, name: t('Status'), width: 160},
  {key: ColumnKey.ACTIONS, name: '', width: 40},
];

const TableWrapper = styled('div')`
  table {
    grid-template-columns: max-content minmax(240px, 1fr) 116px 160px 160px max-content !important;
  }
`;

function getInvestigationPath(organizationSlug: string, investigationId: string) {
  return normalizeUrl(
    `/organizations/${organizationSlug}/seer/investigation/${investigationId}/`
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

function InvestigationsPage() {
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
  });

  const createMutation = useCreateInvestigationMutation(organization.slug, {
    onSuccess: () => addSuccessMessage(t('Investigation created.')),
    onError: () => addErrorMessage(t('Unable to create investigation.')),
  });

  const favoriteMutation = useSetInvestigationFavoriteMutation(organization.slug, {
    onSuccess: (_data, {investigation, shouldFavorite}) => {
      updateInvestigationCache(
        queryClient,
        organization.slug,
        investigation.id,
        current => ({...current, isFavorited: shouldFavorite})
      );
      addSuccessMessage(t('Investigation favorite updated.'));
    },
    onError: () => addErrorMessage(t('Unable to update investigation favorite.')),
  });

  const duplicateMutation = useDuplicateInvestigationMutation(organization.slug, {
    onSuccess: () => addSuccessMessage(t('Investigation duplicated.')),
    onError: () => addErrorMessage(t('Unable to duplicate investigation.')),
  });

  const deleteMutation = useDeleteInvestigationMutation(organization.slug, {
    onSuccess: (_data, investigation) => {
      queryClient.removeQueries({
        queryKey: investigationDetailQueryOptions(organization.slug, investigation.id)
          .queryKey,
        exact: true,
      });
      addSuccessMessage(t('Investigation deleted.'));
    },
    onError: () => addErrorMessage(t('Unable to delete investigation.')),
  });

  function handleSearch(nextQuery: string) {
    setQueryParams({
      query: nextQuery || null,
      cursor: null,
    });
  }

  function renderActions(investigation: InvestigationListItem) {
    return (
      <DropdownMenu
        items={[
          {
            key: 'copy-link',
            label: t('Copy link'),
            onAction: () =>
              copy(
                `${window.location.origin}${getInvestigationPath(
                  organization.slug,
                  investigation.id
                )}`,
                {successMessage: t('Investigation link copied.')}
              ),
          },
          {
            key: 'duplicate',
            label: t('Duplicate'),
            onAction: () => duplicateMutation.mutate(investigation),
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
                onConfirm: () => deleteMutation.mutate(investigation),
              }),
          },
        ]}
        triggerProps={{
          size: 'sm',
          showChevron: false,
          variant: 'transparent',
          icon: <IconEllipsis />,
          'aria-label': t('More options for %s', investigation.title),
        }}
        position="bottom-end"
        usePortal
      />
    );
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
                  investigationDetailQueryOptions(organization.slug, investigation.id)
                )
              }
            >
              {investigation.title}
            </Link>
          </Text>
        );
      case ColumnKey.BLOCKS:
        return investigation.blockCount;
      case ColumnKey.CREATED:
        return <TimeSince date={investigation.dateCreated} />;
      case ColumnKey.STATUS:
        return investigation.status === 'active' ? t('Active') : null;
      case ColumnKey.ACTIONS:
        return renderActions(investigation);
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
            <Layout.Title>{t('Investigations')}</Layout.Title>
            <Layout.Body>
              <Layout.Main width="full">
                <Grid
                  columns={{zero: 'auto', xl: 'auto max-content max-content'}}
                  gap="md"
                  marginBottom="xl"
                >
                  <SearchBar
                    defaultQuery=""
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
                  <Button
                    variant="primary"
                    icon={<IconAdd />}
                    onClick={() => createMutation.mutate()}
                    busy={createMutation.isPending}
                  >
                    {t('Launch investigation')}
                  </Button>
                </Grid>
                <TableWrapper>
                  <GridEditable
                    data={investigations}
                    columnOrder={COLUMNS}
                    columnSortBy={[]}
                    grid={{
                      renderHeadCell: column => column.name,
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
                    pageLinks={data?.headers.Link}
                    onCursor={(nextCursor, _path, _nextQuery, direction) => {
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

  return (
    <AnalyticsArea name="investigations.list" overrideParent>
      <Feature
        organization={organization}
        features="organizations:investigations"
        renderDisabled={() => <FeatureDisabledPage />}
      >
        {organization.openMembership ? <InvestigationsPage /> : <ClosedMembershipPage />}
      </Feature>
    </AnalyticsArea>
  );
}
