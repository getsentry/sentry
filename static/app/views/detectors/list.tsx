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
import {Detector} from 'sentry/views/detectors/components/detectorListRow';
import DetectorListTable from 'sentry/views/detectors/components/detectorListTable';

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const detectors: Detector[] = [
    {
      automations: [
        {
          name: '/endpoint',
          project: {slug: 'javascript', platform: 'javascript'},
          description: 'transaction.duration',
          link: 'monitors/def456',
        },
        {
          name: '/checkout',
          project: {slug: 'javascript', platform: 'javascript'},
          description: 'transaction.duration',
          link: 'monitors/ghi789',
        },
      ],
      groups: [
        {
          shortId: 'abc123',
          project: {
            slug: 'javascript',
            platform: 'javascript',
          },
          lastSeen: new Date().toString(),
        },
      ],
      id: '123',
      link: 'hello.com',
      name: 'Sample Detector 1',
      project: {
        slug: 'javascript',
        platform: 'javascript',
      },
      details: ['transaction.duration'],
    },
    {
      automations: [],
      groups: [
        {
          shortId: 'def123',
          project: {
            slug: 'android',
            platform: 'android',
          },
          lastSeen: new Date().toString(),
        },
      ],
      id: '456',
      link: 'hello.com',
      name: 'Sample Detector 2',
      project: {
        slug: 'android',
        platform: 'android',
      },
      details: ['transaction.duration'],
    },
    {
      automations: [
        {
          name: '/endpoint',
          project: {slug: 'javascript', platform: 'javascript'},
          description: 'transaction.duration',
          link: 'monitors/def456',
        },
        {
          name: '/checkout',
          project: {slug: 'javascript', platform: 'javascript'},
          description: 'transaction.duration',
          link: 'monitors/ghi789',
        },
      ],
      groups: [
        {
          shortId: 'rip',
          project: {
            platform: 'android',
          },
          lastSeen: new Date().toString(),
        },
      ],
      id: '789',
      link: 'hello.com',
      name: 'Sample Detector 3',
      project: {
        slug: 'android',
        platform: 'android',
      },
      details: ['transaction.duration'],
      disabled: true,
    },
  ];

  return (
    <SentryDocumentTitle title={t('Monitors')} noSuffix>
      <ActionsProvider actions={<Actions />}>
        <ListLayout>
          <TableHeader />
          <DetectorListTable detectors={detectors} />
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
      <LinkButton to="/monitors/new/" priority="primary" icon={<IconAdd isCircled />}>
        {t('Create Monitor')}
      </LinkButton>
    </Fragment>
  );
}
