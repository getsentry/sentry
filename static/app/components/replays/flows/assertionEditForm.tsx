import styled from '@emotion/styled';

import DatePicker from 'sentry/components/calendar/datePicker';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout/flex';
import {Grid} from 'sentry/components/core/layout/grid';
import {Text} from 'sentry/components/core/text';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import NavigationInput from 'sentry/components/replays/flows/actions/navigationInput';
import TimeoutInput from 'sentry/components/replays/flows/actions/timeoutInput';
import AssertionBaseForm from 'sentry/components/replays/flows/assertionBaseForm';
import AssertionEndActionCreateForm from 'sentry/components/replays/flows/assertionEndActionCreateForm';
import AssertionReplayPlayer from 'sentry/components/replays/flows/assertionReplayPlayer';
import AssertionReplayTable from 'sentry/components/replays/flows/assertionReplayTable';
import AssertionReport from 'sentry/components/replays/flows/assertionReport';
import AssertionStartActionInput from 'sentry/components/replays/flows/assertionStartActionInput';
import {
  SelectedReplayIndexProvider,
  useSelectedReplayIndex,
} from 'sentry/components/replays/queryParams/selectedReplayIndex';
import {IconSeer} from 'sentry/icons';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

interface Props {
  assertion: AssertionFlow;
  setAssertion: (assertion: AssertionFlow) => void;
}

export default function AssertionEditForm({assertion, setAssertion}: Props) {
  const {select: setSelectedReplayIndex} = useSelectedReplayIndex();
  const {selected_replay_id: previewReplayId} = useLocationQuery({
    fields: {
      selected_replay_id: decodeScalar,
    },
  });

  return (
    <PageFiltersContainer>
      <SelectedReplayIndexProvider>
        <Grid columns="50% 1fr" flex="1" minHeight="0">
          <Flex direction="column" gap="2xl" padding="0 3xl 0 0" overflow="auto">
            <Flex gap="lg">
              <AssertionBaseForm disabled />
            </Flex>
            <Flex direction="column" gap="md">
              <Flex gap="xs">
                <StartTag>START</StartTag>
                <Text size="lg">this flow</Text>
              </Flex>
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

            {assertion.ending_actions.map((endingAction, i) => (
              <Flex direction="column" gap="md" key={`${endingAction.type}-${i}`}>
                {i === 0 ? (
                  <Flex gap="xs">
                    <StepTag>END</StepTag>
                    <Text size="lg">this flow</Text>
                  </Flex>
                ) : (
                  <Flex>
                    <StepTag>OR</StepTag>
                  </Flex>
                )}
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
                />
              </Flex>
            ))}
            <Flex direction="column">
              <Flex
                direction="column"
                gap="md"
                padding="md md xl md"
                border="primary"
                radius="lg lg 0 0"
              >
                <Flex align="center" justify="left" gap="md">
                  <Text variant="promotion">
                    <IconSeer color="pink400" />
                  </Text>
                  <Text size="lg" bold variant="promotion">
                    Seer Suggestion
                  </Text>
                </Flex>
                <Text>Try adding this as an ending action:</Text>
                <Flex direction="row" gap="md" padding="0 0 0 3xl">
                  <CompactSelect<string>
                    size="xs"
                    options={[
                      {
                        label: 'Navigation',
                        value: 'navigation',
                      },
                    ]}
                    value={'navigation'}
                  />
                  <NavigationInput
                    initialAction={{
                      type: 'breadcrumb',
                      category: 'navigation',
                      matcher: {
                        url: '*/explore/issues/',
                      },
                    }}
                    onChange={() => {}}
                  />
                </Flex>
                <Text>It will match against 50/123 replays that are timing out</Text>
                <Button size="md" icon={<IconAdd color="pink400" />}>
                  <Text variant="promotion">Add Suggestion</Text>
                </Button>
              </Flex>

              <Button
                priority="primary"
                size="md"
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
                {t('Manually Add Ending Action')}
              </Button>
            </Flex>

            <Flex direction="column" gap="md">
              <Flex gap="xs">
                <TimeoutTag>TIMEOUT</TimeoutTag>
                <Text size="lg">after waiting</Text>
              </Flex>

              <Flex padding="0 0 0 3xl" gap="md" justify="between" direction="column">
                <Flex gap="lg" direction="column">
                  <TimeoutInput
                    initialValue={assertion.timeout}
                    onChange={value => {
                      setAssertion({
                        ...assertion,
                        timeout: value,
                      });
                    }}
                    disabled={false}
                  />

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
            </Flex>
          </Flex>

          {previewReplayId ? (
            <Flex direction="column" gap="md" flex="1" minHeight="0">
              <Flex justify="end">
                <Button
                  aria-label="Hide"
                  icon={<IconClose />}
                  size="xs"
                  onClick={() => {
                    setSelectedReplayIndex('', '');
                  }}
                />
              </Flex>
              <AssertionReplayPlayer replaySlug={previewReplayId} />
            </Flex>
          ) : (
            <Flex direction="column" flex="1" align="start" gap="xl">
              <DatePageFilter />
              <AssertionReport flow={assertion} />
              <StyledNegativeSpaceContainer />
            </Flex>
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

const StartTag = styled('span')`
  font-weight: bold;
  border: 1px solid ${p => p.theme.tag.info.border};
  padding: 0 4px;
  border-radius: 4px;
  background-color: ${p => p.theme.tag.info.background};
  color: ${p => p.theme.tag.info.color};
  font-size: ${p => p.theme.fontSize.sm};
  width: 70px;
  text-align: center;
`;

const StepTag = styled('span')`
  font-weight: bold;
  border: 1px solid ${p => p.theme.tag.success.border};
  padding: 0 4px;
  border-radius: 4px;
  background-color: ${p => p.theme.tag.success.background};
  color: ${p => p.theme.tag.success.color};
  font-size: ${p => p.theme.fontSize.sm};
  width: 70px;
  text-align: center;
`;
const TimeoutTag = styled('span')`
  font-weight: bold;
  border: 1px solid ${p => p.theme.tag.error.border};
  padding: 0 4px;
  border-radius: 4px;
  background-color: ${p => p.theme.tag.error.background};
  color: ${p => p.theme.tag.error.color};
  font-size: ${p => p.theme.fontSize.sm};
  width: 70px;
  text-align: center;
`;
