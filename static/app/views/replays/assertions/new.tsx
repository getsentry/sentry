import {useState} from 'react';
import styled from '@emotion/styled';
import {uuid4} from '@sentry/core';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Grid} from 'sentry/components/core/layout/grid';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {SelectedReplayIndexProvider} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import AssertionReplayPlayer from 'sentry/utils/replays/assertions/assertionReplayPlayer';
import AssertionReplayTable from 'sentry/utils/replays/assertions/assertionReplayTable';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useOrganization from 'sentry/utils/useOrganization';
import type {AssertionFlow} from 'sentry/views/replays/assertions/types';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplaysSearch from 'sentry/views/replays/list/search';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  environment: string;
  projectId: string;
}

export default function ReplayAssertionNew({environment, projectId}: Props) {
  const [assertion, setAssertion] = useState<AssertionFlow>(() => ({
    alerts_enabled: false,
    assigned_to: undefined,
    created_at: new Date().toISOString(), // ISO 8601
    description: '',
    ending_actions: [],
    environment,
    id: uuid4(),
    name: '',
    prev_id: undefined,
    project_id: projectId,
    starting_action: {matcher: null, type: 'null'},
    status: 'success',
    timeout: 5 * 60 * 1000, // 5 minutes
  }));

  const crumbs = useCrumbs({
    name: assertion.name,
    setName: name => setAssertion({...assertion, name}),
  });

  const {getParamValue: getReplaySlug, setParamValue: setReplaySlug} =
    useUrlParams('replaySlug');
  const replaySlug = getReplaySlug();

  return (
    <SentryDocumentTitle title={t('New Assertion')}>
      <FullViewport style={{height: '100vh'}}>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <Button priority="primary">Save</Button>
          </Layout.HeaderActions>
        </Layout.Header>
        <PageFiltersContainer>
          <SelectedReplayIndexProvider>
            <Body>
              <Flex>
                <Flex gap="xl" wrap="wrap" flex="1">
                  <ReplaysFilters />
                  <ReplaysSearch />
                </Flex>
              </Flex>

              <Grid columns="minmax(412px, 20%) 1fr" gap="lg" flex="1">
                <AssertionReplayTable onSelect={setReplaySlug} />
                {replaySlug ? (
                  <AssertionReplayPlayer replaySlug={replaySlug} />
                ) : (
                  <StyledNegativeSpaceContainer />
                )}
              </Grid>
            </Body>
          </SelectedReplayIndexProvider>
        </PageFiltersContainer>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

function useCrumbs({name, setName}: {name: string; setName: (name: string) => void}) {
  const organization = useOrganization();
  return [
    {
      label: t('Replay'),
      to: {
        pathname: makeReplaysPathname({
          path: '/',
          organization,
        }),
      },
    },
    {
      label: t('Assertions'),
      to: {
        pathname: makeReplaysPathname({
          path: '/assertions/table/',
          organization,
        }),
      },
    },
    {
      label: t('New Assertion'),
    },
    {
      label: <Input value={name} onChange={e => setName(e.target.value)} size="md" />,
    },
  ];
}

const Body = styled('div')`
  background-color: ${p => p.theme.background};
  padding: ${p => p.theme.space.lg};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
  min-height: 0;
  flex: 1;
  height: 100%;
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;
