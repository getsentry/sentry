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
import type {Automation} from 'sentry/views/automations/components/automationListRow';
import AutomationListTable from 'sentry/views/automations/components/automationListTable';

export default function AutomationsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const automations: Automation[] = [
    {
      actions: ['email'],
      lastTriggered: new Date(Date.now() - 25 * 60 * 60 * 1000),
      monitors: [
        {
          name: 'test automation',
          project: {slug: 'bruh', platform: 'android'},
          description: 'transaction.duration',
          link: 'automations/jkl012',
        },
        {
          name: 'test python automation',
          project: {slug: 'bruh.py', platform: 'python'},
          link: 'automations/mno345',
        },
        {
          name: 'test swift automation',
          project: {slug: 'bruh.swift', platform: 'swift'},
          link: 'automations/pqr678',
        },
      ],
      id: '123',
      link: 'hello.com',
      name: 'Email suggested assignees',
      project: {
        slug: 'javascript',
        platform: 'javascript',
      },
    },
    {
      actions: ['email', 'slack'],
      lastTriggered: new Date(Date.now() - 60 * 60 * 60 * 1000),
      monitors: [],
      id: '234',
      link: 'hello.com',
      name: 'Email and slack suggested assignees',
      project: {
        slug: 'sentry',
        platform: 'python',
      },
    },
  ];

  return (
    <SentryDocumentTitle title={t('Automations')} noSuffix>
      <ActionsProvider actions={<Actions />}>
        <ListLayout>
          <TableHeader />
          <AutomationListTable automations={automations} />
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
