import {useState} from 'react';
import styled from '@emotion/styled';
import {uuid4} from '@sentry/core';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Flex} from 'sentry/components/core/layout/flex';
import {Grid} from 'sentry/components/core/layout/grid';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {SelectedReplayIndexProvider} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import AssertionClicksTable from 'sentry/utils/replays/assertions/assertionClicksTable';
import AssertionReplayPlayer from 'sentry/utils/replays/assertions/assertionReplayPlayer';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import type {AssertionFlow} from 'sentry/views/replays/assertions/types';
import ReplaysSearch from 'sentry/views/replays/list/search';

interface Props {
  environment: string;
  name: string;
  projectId: string;
}

export default function AssertionCreateForm({projectId, environment, name}: Props) {
  const [assertion, setAssertion] = useState<AssertionFlow>(() => ({
    alerts_enabled: false,
    assigned_to: undefined,
    created_at: new Date().toISOString(), // ISO 8601
    description: '',
    ending_actions: [],
    environment,
    id: uuid4(),
    name,
    prev_id: undefined,
    project_id: projectId,
    starting_action: {matcher: null, type: 'null'},
    status: 'success',
    timeout: 5 * 60 * 1000, // 5 minutes
  }));

  const {getParamValue: getReplaySlug, setParamValue: setReplaySlug} =
    useUrlParams('replaySlug');
  const replaySlug = getReplaySlug();

  // eslint-disable-next-line no-console
  console.log('New Assertion State', {assertion, setAssertion});

  return (
    <PageFiltersContainer>
      <SelectedReplayIndexProvider>
        <Flex>
          <Flex gap="xl" wrap="wrap" flex="1">
            <PageFilterBar condensed>
              <DatePageFilter resetParamsOnChange={['cursor']} />
            </PageFilterBar>
            <ReplaysSearch />
          </Flex>
        </Flex>

        <Grid columns="minmax(412px, 20%) 1fr" gap="lg" flex="1">
          <AssertionClicksTable
            environment={environment}
            onSelect={setReplaySlug}
            projectId={projectId}
          />
          {replaySlug ? (
            <AssertionReplayPlayer replaySlug={replaySlug} />
          ) : (
            <StyledNegativeSpaceContainer />
          )}
        </Grid>
      </SelectedReplayIndexProvider>
    </PageFiltersContainer>
  );
}

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;
