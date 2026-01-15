import {Fragment} from 'react';
import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {Hovercard} from 'sentry/components/hovercard';
import * as Layout from 'sentry/components/layouts/thirds';
import Pagination from 'sentry/components/pagination';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {unreachable} from 'sentry/utils/unreachable';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import AllViewsWelcomeBanner from 'sentry/views/issueList/issueViews/issueViewsList/allViewsWelcomeBanner';
import {IssueViewsTable} from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsTable';
import {
  DEFAULT_ENVIRONMENTS,
  DEFAULT_TIME_FILTERS,
} from 'sentry/views/issueList/issueViews/utils';
import {useCreateGroupSearchView} from 'sentry/views/issueList/mutations/useCreateGroupSearchView';
import {useDeleteGroupSearchView} from 'sentry/views/issueList/mutations/useDeleteGroupSearchView';
import {useUpdateGroupSearchViewStarred} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarred';
import type {GroupSearchViewBackendSortOption} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {
  makeFetchGroupSearchViewsKey,
  useFetchGroupSearchViews,
} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {
  GroupSearchViewCreatedBy,
  GroupSearchViewSort,
  type GroupSearchView,
} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

type IssueViewSectionProps = {
  createdBy: GroupSearchViewCreatedBy;
  cursorQueryParam: string;
  limit: number;
  emptyState?: React.ReactNode;
};

// We expose a few simplified sort options which are mapped to multiple
// backend sorts to provide the best results.
function getEndpointSort(
  sort: GroupSearchViewSort = GroupSearchViewSort.POPULARITY
): GroupSearchViewBackendSortOption[] {
  switch (sort) {
    case GroupSearchViewSort.POPULARITY:
      return ['-popularity', '-visited', '-created'];
    case GroupSearchViewSort.NAME_ASC:
      return ['name', '-visited', '-created'];
    case GroupSearchViewSort.NAME_DESC:
      return ['-name', '-visited', '-created'];
    case GroupSearchViewSort.VIEWED:
      return ['-visited', '-popularity', '-created'];
    case GroupSearchViewSort.CREATED_ASC:
      return ['created', '-popularity', '-visited'];
    case GroupSearchViewSort.CREATED_DESC:
      return ['-created', '-popularity', '-visited'];
    default:
      unreachable(sort);
      return [];
  }
}

function useIssueViewSort(): GroupSearchViewSort {
  const location = useLocation();
  const sort = location.query.sort ?? GroupSearchViewSort.POPULARITY;

  return sort as GroupSearchViewSort;
}

function IssueViewSection({
  createdBy,
  limit,
  cursorQueryParam,
  emptyState,
}: IssueViewSectionProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const sort = useIssueViewSort();
  const query = typeof location.query.query === 'string' ? location.query.query : '';
  const cursor =
    typeof location.query[cursorQueryParam] === 'string'
      ? location.query[cursorQueryParam]
      : undefined;
  const queryClient = useQueryClient();
  const endpointSort = getEndpointSort(sort);

  const {
    data: views = [],
    isPending,
    isError,
    getResponseHeader,
  } = useFetchGroupSearchViews(
    {
      orgSlug: organization.slug,
      createdBy,
      limit,
      sort: endpointSort,
      cursor,
      query,
    },
    {staleTime: 0}
  );

  const tableQueryKey = makeFetchGroupSearchViewsKey({
    orgSlug: organization.slug,
    createdBy,
    limit,
    cursor,
    sort: endpointSort,
    query,
  });

  const {mutate: mutateViewStarred} = useUpdateGroupSearchViewStarred({
    onMutate: variables => {
      setApiQueryData<GroupSearchView[]>(queryClient, tableQueryKey, data => {
        return data?.map(view =>
          view.id === variables.id ? {...view, starred: variables.starred} : view
        );
      });
    },
    onError: (_error, variables) => {
      setApiQueryData<GroupSearchView[]>(queryClient, tableQueryKey, data => {
        return data?.map(view =>
          view.id === variables.id ? {...view, starred: !variables.starred} : view
        );
      });
    },
  });
  const {mutate: deleteView} = useDeleteGroupSearchView({
    onMutate: variables => {
      setApiQueryData<GroupSearchView[]>(queryClient, tableQueryKey, data => {
        return data?.filter(v => v.id !== variables.id);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey: tableQueryKey});
    },
  });
  const updateViewName = (view: GroupSearchView) => {
    setApiQueryData<GroupSearchView[]>(queryClient, tableQueryKey, data => {
      return data?.map(v => (v.id === view.id ? {...v, name: view.name} : v));
    });
  };

  useRouteAnalyticsParams(
    isPending
      ? {}
      : {
          [`num_results_${createdBy}`]: views.length,
        }
  );

  const pageLinks = getResponseHeader?.('Link');

  if (emptyState && !isPending && views.length === 0) {
    return emptyState;
  }

  return (
    <Fragment>
      <IssueViewsTable
        type={createdBy}
        views={views}
        isPending={isPending}
        isError={isError}
        handleStarView={view => {
          mutateViewStarred({id: view.id, starred: !view.starred, view});
        }}
        handleDeleteView={view => {
          deleteView({id: view.id});
        }}
        onRenameView={view => {
          updateViewName(view);
        }}
        hideCreatedBy={createdBy === GroupSearchViewCreatedBy.ME}
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={newCursor => {
          navigate(
            {
              pathname: location.pathname,
              query: {
                ...location.query,
                [cursorQueryParam]: newCursor,
              },
            },
            {
              preventScrollReset: true,
            }
          );
        }}
      />
    </Fragment>
  );
}

function NoViewsBanner({
  handleCreateView,
  isCreatingView,
}: {
  handleCreateView: () => void;
  isCreatingView: boolean;
}) {
  const organization = useOrganization();

  return (
    <Banner>
      <BannerTitle>{t('Create your first view')}</BannerTitle>
      <BannerText>
        {t(
          'Your haven’t saved any issue views yet — saving views makes it easier to return to your most frequent search queries, like high priority, assigned to you, or most recent.'
        )}
      </BannerText>
      <Feature
        features="organizations:issue-views"
        hookName="feature-disabled:issue-views"
        renderDisabled={props => (
          <Hovercard
            body={
              <FeatureDisabled
                features={props.features}
                hideHelpToggle
                featureName={t('Issue Views')}
              />
            }
          >
            {typeof props.children === 'function'
              ? props.children(props)
              : props.children}
          </Hovercard>
        )}
      >
        {({hasFeature}) => (
          <BannerAddViewButton
            priority="primary"
            icon={<IconAdd />}
            size="sm"
            onClick={() => {
              trackAnalytics('issue_views.table.banner_create_view_clicked', {
                organization,
              });
              handleCreateView();
            }}
            disabled={!hasFeature || isCreatingView}
          >
            {t('Create View')}
          </BannerAddViewButton>
        )}
      </Feature>
    </Banner>
  );
}

function SortDropdown() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const sort = useIssueViewSort();

  return (
    <CompactSelect
      value={sort}
      trigger={triggerProps => (
        <SelectTrigger.Button {...triggerProps} icon={<IconSort />} />
      )}
      onChange={newSort => {
        trackAnalytics('issue_views.table.sort_changed', {
          organization,
          sort: newSort.value,
        });
        navigate({
          pathname: location.pathname,
          query: {...location.query, sort: newSort.value},
        });
      }}
      options={[
        {
          label: t('Most Starred'),
          value: GroupSearchViewSort.POPULARITY,
        },
        {
          label: t('Recently Viewed'),
          value: GroupSearchViewSort.VIEWED,
        },
        {
          label: t('Name (A-Z)'),
          value: GroupSearchViewSort.NAME_ASC,
        },
        {
          label: t('Name (Z-A)'),
          value: GroupSearchViewSort.NAME_DESC,
        },
        {
          label: t('Created (Newest)'),
          value: GroupSearchViewSort.CREATED_DESC,
        },
        {
          label: t('Created (Oldest)'),
          value: GroupSearchViewSort.CREATED_ASC,
        },
      ]}
    />
  );
}

export default function IssueViewsList() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const query = typeof location.query.query === 'string' ? location.query.query : '';
  const {mutate: createGroupSearchView, isPending: isCreatingView} =
    useCreateGroupSearchView();

  const handleCreateView = () => {
    createGroupSearchView(
      {
        name: t('New View'),
        query: 'is:unresolved',
        projects: [],
        environments: DEFAULT_ENVIRONMENTS,
        timeFilters: DEFAULT_TIME_FILTERS,
        querySort: IssueSortOptions.DATE,
        starred: true,
      },
      {
        onSuccess: data => {
          navigate({
            pathname: normalizeUrl(
              `/organizations/${organization.slug}/issues/views/${data.id}/`
            ),
            query: {
              ...getIssueViewQueryParams({view: data}),
              new: 'true',
            },
          });
        },
      }
    );
  };

  return (
    <SentryDocumentTitle title={t('All Views')} orgSlug={organization.slug}>
      <Layout.Page>
        <Layout.Header unified>
          <Layout.HeaderContent>
            <Layout.Title>{t('All Views')}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar>
              <FeedbackButton
                size="sm"
                feedbackOptions={{
                  formTitle: t('Give Feedback'),
                  messagePlaceholder: t('How can we make issue views better for you?'),
                  tags: {
                    ['feedback.source']: 'custom_views',
                    ['feedback.owner']: 'issues',
                  },
                }}
              />
              <Feature
                features="organizations:issue-views"
                hookName="feature-disabled:issue-views"
                renderDisabled={props => (
                  <Hovercard
                    body={
                      <FeatureDisabled
                        features={props.features}
                        hideHelpToggle
                        featureName={t('Issue Views')}
                      />
                    }
                  >
                    {typeof props.children === 'function'
                      ? props.children(props)
                      : props.children}
                  </Hovercard>
                )}
              >
                {({hasFeature}) => (
                  <Button
                    priority="primary"
                    icon={<IconAdd />}
                    size="sm"
                    disabled={!hasFeature || isCreatingView}
                    busy={isCreatingView}
                    onClick={() => {
                      trackAnalytics('issue_views.table.create_view_clicked', {
                        organization,
                      });
                      handleCreateView();
                    }}
                  >
                    {t('Create View')}
                  </Button>
                )}
              </Feature>
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
        <Layout.Body>
          <MainTableLayout width="full">
            <FilterSortBar>
              <SearchBar
                defaultQuery={query}
                onSearch={newQuery => {
                  navigate({
                    pathname: location.pathname,
                    query: {...location.query, query: newQuery},
                  });
                  trackAnalytics('issue_views.table.search', {
                    organization,
                    query: newQuery,
                  });
                }}
                placeholder={t('Search views by name or query')}
              />
              <SortDropdown />
            </FilterSortBar>
            <AllViewsWelcomeBanner />
            <TableHeading>{t('Created by Me')}</TableHeading>
            <IssueViewSection
              createdBy={GroupSearchViewCreatedBy.ME}
              limit={20}
              cursorQueryParam="mc"
              emptyState={
                <NoViewsBanner
                  handleCreateView={() => {
                    trackAnalytics('issue_views.table.banner_create_view_clicked', {
                      organization,
                    });
                    handleCreateView();
                  }}
                  isCreatingView={isCreatingView}
                />
              }
            />
            <TableHeading>{t('Created by Others')}</TableHeading>
            <IssueViewSection
              createdBy={GroupSearchViewCreatedBy.OTHERS}
              limit={20}
              cursorQueryParam="sc"
            />
          </MainTableLayout>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const Banner = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  margin-top: ${space(2)};
  margin-bottom: 0;
  padding: 12px;
  gap: ${space(1)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  background: linear-gradient(
    269.35deg,
    ${p => p.theme.tokens.background.tertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
`;

const BannerTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BannerText = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  flex-shrink: 0;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    max-width: 75%;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    max-width: 60%;
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    max-width: 50%;
  }
`;

const BannerAddViewButton = styled(Button)`
  align-self: flex-start;
`;

const FilterSortBar = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto;
  gap: ${space(1)};
`;

const TableHeading = styled('h2')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${p => p.theme.fontSize.xl};
  margin-top: ${space(3)};
  margin-bottom: ${space(1.5)};
`;

const MainTableLayout = styled(Layout.Main)`
  container-type: inline-size;
`;
