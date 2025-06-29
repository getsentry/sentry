import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

// import ListContent from 'sentry/views/replays/list/listContent';
import FlowsTable from './flowsTable';
import FlowsTabs from './tabs';

const listFlowDefinitionsResponse = {
  data: [
    {
      id: 'flow1',
      name: 'User Login Flow',
      createdBy: 'John Doe',
      status: 'Active',
      lastSeen: '2024-01-15T10:30:00Z',
      lastChecked: '2024-01-15T09:15:00Z',
      failures: 2,
      linkedIssues: ['ISSUE-123', 'ISSUE-456'],
    },
    {
      id: 'flow2',
      name: 'Payment Processing',
      createdBy: 'Jane Smith',
      status: 'Inactive',
      lastSeen: '2024-01-14T16:45:00Z',
      lastChecked: '2024-01-14T15:30:00Z',
      failures: 0,
      linkedIssues: [],
    },
    {
      id: 'flow3',
      name: 'Product Search',
      createdBy: 'Mike Johnson',
      status: 'Active',
      lastSeen: '2024-01-15T14:20:00Z',
      lastChecked: '2024-01-15T13:45:00Z',
      failures: 1,
      linkedIssues: ['ISSUE-789'],
    },
    {
      id: 'flow4',
      name: 'User Registration',
      createdBy: 'Sarah Wilson',
      status: 'Active',
      lastSeen: '2024-01-15T11:10:00Z',
      lastChecked: '2024-01-15T10:55:00Z',
      failures: 0,
      linkedIssues: [],
    },
    {
      id: 'flow5',
      name: 'Shopping Cart Checkout',
      createdBy: 'David Brown',
      status: 'Inactive',
      lastSeen: '2024-01-13T09:30:00Z',
      lastChecked: '2024-01-13T08:15:00Z',
      failures: 3,
      linkedIssues: ['ISSUE-101', 'ISSUE-102', 'ISSUE-103'],
    },
  ],
  isLoading: false,
  error: null,
};

export default function ReplayAssertionsPage() {
  const replaySlug = 'acd5d72f6ba54385ac80abe9dfadb142';
  const orgSlug = 'codecov';

  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  const {replay, replayRecord} = readerResult;

  console.log({replay});
  console.log({replayRecord});

  // TODO - handle feature flags
  //
  //            <Feature
  //            features={['codecov-ui']}
  //            organization={organization}
  //            renderDisabled={NoAccess}
  //          >
  //            <NoProjectMessage organization={organization}>
  //              {children}
  //            </NoProjectMessage>
  //          </Feature>
  //

  return (
    <SentryDocumentTitle title={`Replay Assertions — ${orgSlug}`}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{t('Replay Assertions')}</Layout.Title>
        </Layout.HeaderContent>
        <FlowsTabs selected="flow-definitions" />
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <FlowsTable
              response={listFlowDefinitionsResponse}
              sort={{field: 'name', kind: 'asc'}}
            />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
