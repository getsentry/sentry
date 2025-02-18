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
import AutomationListTable from 'sentry/views/automations/components/automationListTable';

export default function AutomationsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('Automations')} noSuffix>
      <ActionsProvider actions={<Actions />}>
        <ListLayout>
          <TableHeader />
          <AutomationListTable automations={[]} />
        </ListLayout>
      </ActionsProvider>
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
  return (
    <Fragment>
      <LinkButton to="/automations/new/" priority="primary" icon={<IconAdd isCircled />}>
        {t('Create Automation')}
      </LinkButton>
    </Fragment>
  );
}
