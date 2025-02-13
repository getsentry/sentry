import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import DetectorListTable from 'sentry/views/detectors/detectorListTable';

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('Monitors')} noSuffix>
      <ActionsProvider actions={<Actions />}>
        <ListLayout>
          <h2>Monitors</h2>
          <Flex gap={space(1.5)} column>
            <Flex gap={space(1.5)}>
              <ProjectPageFilter />
              <div style={{flex: 1}}>
                <SearchBar placeholder={t('Search by name')} />
              </div>
            </Flex>
            <DetectorListTable detectors={[]} />
          </Flex>
        </ListLayout>
      </ActionsProvider>
    </SentryDocumentTitle>
  );
}

function Actions() {
  return (
    <Fragment>
      <LinkButton to="/monitors/new/" priority="primary" icon={<IconAdd isCircled />}>
        {t('Create Monitor')}
      </LinkButton>
    </Fragment>
  );
}
