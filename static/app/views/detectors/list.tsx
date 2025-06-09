import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import DetectorListTable from 'sentry/views/detectors/components/detectorListTable';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const location = useLocation();
  const {selection} = usePageFilters();

  const query =
    typeof location.query.query === 'string' ? location.query.query : undefined;
  const sortBy =
    typeof location.query.sort === 'string' ? location.query.sort : undefined;

  const {data: detectors, isPending} = useDetectorsQuery({
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
            <DetectorListTable detectors={detectors ?? []} isPending={isPending} />
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
        <SearchBar placeholder={t('Search for events, users, tags, and more')} />
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
