import {Fragment} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Grid} from 'sentry/components/core/layout/grid';
import {Text} from 'sentry/components/core/text';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ReplayActionPicker from 'sentry/components/replays/flows/actions/replayActionPicker';
import AssertionBaseForm from 'sentry/components/replays/flows/assertionBaseForm';
import AssertionEndActionCreateForm from 'sentry/components/replays/flows/assertionEndActionCreateForm';
import AssertionReplayPlayer from 'sentry/components/replays/flows/assertionReplayPlayer';
import AssertionReplayTable from 'sentry/components/replays/flows/assertionReplayTable';
import AssertionStartActionInput from 'sentry/components/replays/flows/assertionStartActionInput';
import {SelectedReplayIndexProvider} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconPlay} from 'sentry/icons/iconPlay';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useUrlParams from 'sentry/utils/url/useUrlParams';

interface Props {
  assertion: AssertionFlow;
  setAssertion: (assertion: AssertionFlow) => void;
}

export default function AssertionEditForm({assertion, setAssertion}: Props) {
  const {getParamValue: getReplaySlug, setParamValue: setReplaySlug} =
    useUrlParams('replaySlug');
  const replaySlug = getReplaySlug();

  const {selected_replay_id: previewReplayId} = useLocationQuery({
    fields: {
      selected_replay_id: decodeScalar,
    },
  });

  return (
    <PageFiltersContainer>
      <SelectedReplayIndexProvider>
        <Grid columns="50% 1fr" gap="lg" flex="1" minHeight="0">
          <Flex direction="column" gap="md" overflow="auto">
            <Flex gap="lg">
              <AssertionBaseForm disabled />
            </Flex>
            <Flex direction="column" gap="md">
              <Text size="lg">
                <Tag type="info">START</Tag>this flow
              </Text>
              <Flex align="start" gap="md" flex="1" padding="0 0 0 3xl">
                <AssertionStartActionInput
                  action={assertion.starting_action}
                  onChange={action => {
                    setAssertion({...assertion, starting_action: action});
                  }}
                  projectId={assertion.project_id}
                />
              </Flex>
            </Flex>
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
                  onChange={action => {
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

            <Flex direction="column" gap="md" padding="lg" border="danger" radius="lg">
              <Text size="md" bold variant="danger">
                {t('These replays are unaccounted for!')}
              </Text>
              <Flex height="480px">
                <AssertionReplayTable
                  action={{
                    type: 'null',
                    matcher: null,
                  }}
                  projectId={assertion.project_id}
                  style={{width: '100%'}}
                />
              </Flex>
            </Flex>
          </Flex>

          {replaySlug ? (
            <AssertionReplayPlayer replaySlug={replaySlug} />
          ) : (
            <StyledNegativeSpaceContainer>
              {previewReplayId ? (
                <AssertionReplayPlayer replaySlug={previewReplayId} />
              ) : null}
            </StyledNegativeSpaceContainer>
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
