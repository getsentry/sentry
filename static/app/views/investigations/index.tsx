import {useCallback} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {Query} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
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
import {decodeScalar} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  createInvestigation,
  deleteInvestigation,
  duplicateInvestigation,
  investigationListQueryOptions,
  setInvestigationFavorite,
} from 'sentry/views/investigations/api';
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
  {key: ColumnKey.BLOCKS, name: t('Blocks'), width: 96},
  {key: ColumnKey.CREATED, name: t('Created'), width: 140},
  {key: ColumnKey.STATUS, name: t('Status'), width: 160},
  {key: ColumnKey.ACTIONS, name: '', width: 40},
];

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
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {copy} = useCopyToClipboard();
  const query = decodeScalar(location.query.query);
  const cursor = decodeScalar(location.query.cursor);

  const listOptions = investigationListQueryOptions({
    organizationSlug: organization.slug,
    query,
    cursor,
  });
  const {data, isPending, isError, error} = useQuery({
    ...listOptions,
    select: selectJsonWithHeaders,
  });

  const invalidateList = useCallback(
    () => queryClient.invalidateQueries({queryKey: listOptions.queryKey}),
    [listOptions.queryKey, queryClient]
  );

  const createMutation = useMutation({
    mutationFn: () => createInvestigation(organization.slug),
    onSuccess: () => {
      addSuccessMessage(t('Investigation created.'));
      invalidateList();
    },
    onError: () => addErrorMessage(t('Unable to create investigation.')),
  });

  const favoriteMutation = useMutation({
    mutationFn: ({investigation, shouldFavorite}: FavoriteVariables) =>
      setInvestigationFavorite(organization.slug, investigation.id, shouldFavorite),
    onSuccess: () => {
      addSuccessMessage(t('Investigation favorite updated.'));
      invalidateList();
    },
    onError: () => addErrorMessage(t('Unable to update investigation favorite.')),
  });

  const duplicateMutation = useMutation({
    mutationFn: (investigation: InvestigationListItem) =>
      duplicateInvestigation(organization.slug, investigation.id),
    onSuccess: () => {
      addSuccessMessage(t('Investigation duplicated.'));
      invalidateList();
    },
    onError: () => addErrorMessage(t('Unable to duplicate investigation.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (investigation: InvestigationListItem) =>
      deleteInvestigation(organization.slug, investigation),
    onSuccess: () => {
      addSuccessMessage(t('Investigation deleted.'));
      invalidateList();
    },
    onError: () => addErrorMessage(t('Unable to delete investigation.')),
  });

  function handleSearch(nextQuery: string) {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: nextQuery || undefined,
        cursor: undefined,
      },
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
                `${window.location.origin}${normalizeUrl(
                  `/organizations/${organization.slug}/seer/${investigation.id}/`
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
        trigger={triggerProps => (
          <Button
            {...triggerProps}
            size="zero"
            variant="transparent"
            icon={<IconEllipsis />}
            aria-label={t('More options for %s', investigation.title)}
          />
        )}
        position="bottom-end"
      />
    );
  }

  const renderBodyCell = (
    column: GridColumnOrder<ColumnKey>,
    investigation: InvestigationListItem
  ) => {
    switch (column.key) {
      case ColumnKey.NAME:
        return <Text ellipsis>{investigation.title}</Text>;
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
                    query={query}
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
                      const item = investigation;
                      return [
                        <Button
                          key={item.id}
                          size="zero"
                          variant="transparent"
                          aria-label={
                            item.isFavorited
                              ? t('Unfavorite %s', item.title)
                              : t('Favorite %s', item.title)
                          }
                          icon={
                            <IconStar
                              size="sm"
                              variant={item.isFavorited ? 'warning' : 'muted'}
                              isSolid={item.isFavorited}
                            />
                          }
                          onClick={() =>
                            favoriteMutation.mutate({
                              investigation: item,
                              shouldFavorite: !item.isFavorited,
                            })
                          }
                        />,
                      ];
                    },
                    prependColumnWidths: ['max-content'],
                  }}
                  isLoading={isPending}
                  emptyMessage={
                    <EmptyStateWarning>
                      <Text as="p">
                        {t('Sorry, no investigations match your filters.')}
                      </Text>
                    </EmptyStateWarning>
                  }
                />
                <Container marginBottom="2xl">
                  <Pagination
                    pageLinks={data?.headers.Link}
                    onCursor={(nextCursor, path, nextQuery, direction) => {
                      const offset = Number(nextCursor?.split?.(':')?.[1] ?? 0);
                      const paginationQuery: Query & {cursor?: string} = {
                        ...nextQuery,
                        cursor: nextCursor,
                      };
                      if (direction === -1 && offset <= 0) {
                        delete paginationQuery.cursor;
                      }
                      navigate({pathname: path, query: paginationQuery});
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

type FavoriteVariables = {
  investigation: InvestigationListItem;
  shouldFavorite: boolean;
};

export default function InvestigationsView() {
  const organization = useOrganization();

  return (
    <Feature
      organization={organization}
      features="organizations:investigations"
      renderDisabled={() => <FeatureDisabledPage />}
    >
      {organization.openMembership ? <InvestigationsPage /> : <ClosedMembershipPage />}
    </Feature>
  );
}
