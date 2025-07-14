import {Fragment, useCallback} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import AutomationListTable from 'sentry/views/automations/components/automationListTable';
import {AutomationSearch} from 'sentry/views/automations/components/automationListTable/search';
import {AUTOMATION_LIST_PAGE_LIMIT} from 'sentry/views/automations/constants';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

export default function AutomationsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();

  const {
    sort: sorts,
    query,
    cursor,
  } = useLocationQuery({
    fields: {
      sort: decodeSorts,
      query: decodeScalar,
      cursor: decodeScalar,
    },
  });
  const sort = sorts[0] ?? {kind: 'desc', field: 'connectedDetectors'};

  const {
    data: automations,
    isPending,
    isError,
    isSuccess,
    getResponseHeader,
  } = useAutomationsQuery({
    cursor,
    query,
    sortBy: sort ? `${sort?.kind === 'asc' ? '' : '-'}${sort?.field}` : undefined,
    projects: selection.projects,
    limit: AUTOMATION_LIST_PAGE_LIMIT,
  });

  return (
    <SentryDocumentTitle title={t('Automations')} noSuffix>
      <PageFiltersContainer>
        <ListLayout actions={<Actions />}>
          <TableHeader />
          <div>
            <AutomationListTable
              automations={automations ?? []}
              isPending={isPending}
              isError={isError}
              isSuccess={isSuccess}
              sort={sort}
            />
            <Pagination
              pageLinks={getResponseHeader?.('Link')}
              onCursor={newCursor => {
                navigate({
                  pathname: location.pathname,
                  query: {...location.query, cursor: newCursor},
                });
              }}
            />
          </div>
        </ListLayout>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function TableHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQuery =
    typeof location.query.query === 'string' ? location.query.query : '';

  const onSearch = useCallback(
    (query: string) => {
      navigate({
        pathname: location.pathname,
        query: {...location.query, query, cursor: undefined},
      });
    },
    [location.pathname, location.query, navigate]
  );

  return (
    <Flex gap={space(2)}>
      <ProjectPageFilter size="md" />
      <div style={{flexGrow: 1}}>
        <AutomationSearch initialQuery={initialQuery} onSearch={onSearch} />
      </div>
    </Flex>
  );
}

function Actions() {
  const organization = useOrganization();
  return (
    <Fragment>
      <LinkButton
        to={`${makeAutomationBasePathname(organization.slug)}new/`}
        priority="primary"
        icon={<IconAdd />}
        size="sm"
      >
        {t('Create Automation')}
      </LinkButton>
    </Fragment>
  );
}
