import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

  const query =
    typeof location.query.query === 'string' ? location.query.query : undefined;
  const cursor =
    typeof location.query.cursor === 'string' ? location.query.cursor : undefined;

  const {
    data: automations,
    isPending,
    isError,
    isSuccess,
    getResponseHeader,
  } = useAutomationsQuery({
    cursor,
    query,
    projects: selection.projects,
    limit: AUTOMATION_LIST_PAGE_LIMIT,
  });

  return (
    <SentryDocumentTitle title={t('Automations')} noSuffix>
      <PageFiltersContainer>
        <ActionsProvider actions={<Actions />}>
          <ListLayout>
            <TableHeader />
            <div>
              <AutomationListTable
                automations={automations ?? []}
                isPending={isPending}
                isError={isError}
                isSuccess={isSuccess}
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
        </ActionsProvider>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function TableHeader() {
  return (
    <Flex gap={space(2)}>
      <ProjectPageFilter size="md" />
      <div style={{flexGrow: 1}}>
        <AutomationSearch />
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
