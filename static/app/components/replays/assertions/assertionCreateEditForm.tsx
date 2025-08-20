import {Fragment} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Grid} from 'sentry/components/core/layout/grid';
import {Text} from 'sentry/components/core/text';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ReplayActionPicker from 'sentry/components/replays/assertions/actions/replayActionPicker';
import AssertionEndActionCreateForm from 'sentry/components/replays/assertions/assertionEndActionCreateForm';
import AssertionReplayPlayer from 'sentry/components/replays/assertions/assertionReplayPlayer';
import AssertionStartActionCreateForm from 'sentry/components/replays/assertions/assertionStartActionCreateForm';
import {SelectedReplayIndexProvider} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconPlay} from 'sentry/icons/iconPlay';
import {t} from 'sentry/locale';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useUrlParams from 'sentry/utils/url/useUrlParams';

interface Props {
  assertion: AssertionFlow;
  setAssertion: (assertion: AssertionFlow) => void;
}

export default function AssertionCreateEditForm({assertion, setAssertion}: Props) {
  const {getParamValue: getReplaySlug, setParamValue: setReplaySlug} =
    useUrlParams('replaySlug');
  const replaySlug = getReplaySlug();

  return (
    <PageFiltersContainer>
      <SelectedReplayIndexProvider>
        <Flex>
          <Flex align="center" gap="md" flex="1">
            <Text size="lg">
              <Tag type="info">START</Tag>
              this flow
            </Text>
            <AssertionStartActionCreateForm
              action={assertion.starting_action}
              onActionSubmit={action => {
                setAssertion({...assertion, starting_action: action});
              }}
              projectId={assertion.project_id}
            />
          </Flex>
        </Flex>
        {/* <Flex>
          <Flex gap="xl" wrap="wrap" flex="1">
            <PageFilterBar condensed>
              <DatePageFilter resetParamsOnChange={['cursor']} />
            </PageFilterBar>
            <ReplaysSearch />
          </Flex>
        </Flex> */}
        <Grid columns="50% 1fr" gap="lg" flex="1">
          <Flex direction="column" gap="md">
            <Flex>
              <Text size="lg">
                <Tag type="info">END</Tag>this flow
              </Text>
            </Flex>
            {assertion.ending_actions.map((endingAction, i) => (
              <Fragment key={`${endingAction.type}-${i}`}>
                {i === 0 ? null : <Tag type="info">OR</Tag>}
                <AssertionEndActionCreateForm
                  action={endingAction}
                  onActionSubmit={action => {
                    if (!action) {
                      const newList = [...assertion.ending_actions];
                      newList.splice(i, 1);
                      setAssertion({
                        ...assertion,
                        ending_actions: newList,
                      });
                    } else if (assertion.ending_actions[i] !== action) {
                      const newList = [...assertion.ending_actions];
                      newList.splice(i, 1, action);
                      setAssertion({
                        ...assertion,
                        ending_actions: newList,
                      });
                    }
                  }}
                  projectId={assertion.project_id}
                >
                  <ReplayActionPicker
                    projectId={assertion.project_id}
                    onSelect={setReplaySlug}
                  >
                    {replaySlug ? (
                      <span>Example: {replaySlug}</span>
                    ) : (
                      <Button size="sm" aria-label="Pick a replay" icon={<IconPlay />} />
                    )}
                  </ReplayActionPicker>
                </AssertionEndActionCreateForm>
              </Fragment>
            ))}
            <Button
              priority="primary"
              size="xs"
              icon={<IconAdd />}
              onClick={() => {
                setAssertion({
                  ...assertion,
                  ending_actions: [
                    ...assertion.ending_actions,
                    {type: 'null', matcher: null},
                  ],
                });
              }}
            >
              {t('Add Ending Action')}
            </Button>
          </Flex>

          {/* <AssertionReplayTable
            environment={assertion.environment}
            onSelect={setReplaySlug}
            projectId={assertion.project_id}
          /> */}
          {/* <AssertionClicksTable
            environment={assertion.environment}
            onSelect={setReplaySlug}
            projectId={assertion.project_id}
          /> */}
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
