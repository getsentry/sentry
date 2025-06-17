import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout/flex';
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
import DetectorListTable from 'sentry/views/detectors/components/detectorListTable';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();

  const query =
    typeof location.query.query === 'string' ? location.query.query : undefined;
  const sortBy =
    typeof location.query.sort === 'string' ? location.query.sort : undefined;
  const cursor =
    typeof location.query.cursor === 'string' ? location.query.cursor : undefined;

  const {
    data: detectors,
    isPending,
    getResponseHeader,
  } = useDetectorsQuery({
    cursor,
    query,
    sortBy,
    projects: selection.projects,
  });

  return (
    <SentryDocumentTitle title={t('Monitors')} noSuffix>
      <PageFiltersContainer>
        <ActionsProvider actions={<Actions />}>
          <ListLayout>
            <TableHeader />
            <div>
              <DetectorListTable detectors={detectors ?? []} isPending={isPending} />
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
      <ProjectPageFilter />
      <div style={{flexGrow: 1}}>
        <DetectorSearch />
      </div>
    </Flex>
  );
}

function Actions() {
  const organization = useOrganization();
  return (
    <Fragment>
      <LinkButton
        to={`${makeMonitorBasePathname(organization.slug)}new/`}
        priority="primary"
        icon={<IconAdd />}
        size="sm"
      >
        {t('Create Monitor')}
      </LinkButton>
    </Fragment>
  );
}
