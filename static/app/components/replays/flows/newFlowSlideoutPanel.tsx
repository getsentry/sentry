import {useMemo, useReducer} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {MotionNodeAnimationOptions} from 'framer-motion';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Stack} from 'sentry/components/core/layout/stack';
import {Text} from 'sentry/components/core/text';
import NavigationInput from 'sentry/components/replays/flows/actions/navigationInput';
import AssertionReplayTable from 'sentry/components/replays/flows/assertionReplayTable';
import AssertionStartActionInput from 'sentry/components/replays/flows/assertionStartActionInput';
import newFlowReducer, {
  defaultNewFlow,
} from 'sentry/components/replays/flows/newFlowReducer';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {EnvironmentSelector} from 'sentry/components/workflowEngine/form/environmentSelector';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconClose} from 'sentry/icons/iconClose';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import type {AssertionFlow} from 'sentry/utils/replays/assertions/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getProjectOptions} from 'sentry/views/alerts/rules/utils';

const ANIMATION_SETTINGS: MotionNodeAnimationOptions['transition'] = {
  type: 'tween',
  duration: 0.5,
};

interface Props {
  onClose: () => void;
  onSave: (flow: AssertionFlow) => void;
}

export default function NewFlowSlideoutPanel({onClose, onSave}: Props) {
  const theme = useTheme();
  const organization = useOrganization();
  const {projects} = useProjects();

  const {selection} = usePageFilters();

  const projectOptions = useMemo(
    () =>
      getProjectOptions({
        organization,
        projects,
        isFormDisabled: false,
      }),
    [organization, projects]
  );

  const [flow, dispatch] = useReducer(newFlowReducer, defaultNewFlow(selection));

  const hasProjectId = Boolean(flow.project_id);
  const hasStartingAction = flow.starting_action.type !== 'null';

  return (
    <SlideOverPanel
      collapsed={false}
      slidePosition="left"
      transitionProps={ANIMATION_SETTINGS}
    >
      <SlideoutHeaderWrapper>
        <Breadcrumbs
          crumbs={[
            {label: t('Replay')},
            {label: t('Flows')},
            {label: t('Create New Flow')},
          ]}
        />
        <Button
          priority="link"
          size="zero"
          borderless
          aria-label={t('Close Widget Builder')}
          icon={<IconClose size="sm" />}
          onClick={onClose}
          style={{color: theme.subText}}
        >
          {t('Close')}
        </Button>
      </SlideoutHeaderWrapper>
      <Flex padding="3xl" direction="column">
        <Flex direction="column" gap="2xl">
          <List gap="3xl">
            <ListItem>
              <Flex direction="column" gap="xs">
                <label htmlFor="flow-name-input">
                  <Text size="lg">{t('Flow Name')}</Text>
                </label>
                <Input
                  id="flow-name-input"
                  placeholder={t('Name')}
                  onChange={e => dispatch({type: 'set_name', name: e.target.value})}
                  value={flow.name}
                />
              </Flex>
            </ListItem>
            <ListItem>
              <Flex direction="column" gap="xs">
                <label htmlFor="project-select">
                  <Text size="lg">{t('Project')}</Text>
                </label>
                <CompactSelect
                  size="sm"
                  value={flow.project_id}
                  options={projectOptions}
                  onChange={({value}: {value: Project['id']}) =>
                    dispatch({type: 'set_project_id', project_id: value})
                  }
                  style={{width: '100%'}}
                  triggerProps={{
                    id: 'project-select',
                    style: {display: 'flex', flexGrow: 1},
                  }}
                />
              </Flex>
            </ListItem>
            <ListItem>
              <Flex direction="column" gap="xs">
                <label htmlFor="environment-select">
                  <Text size="lg">{t('Environment')}</Text>
                </label>
                <EnvironmentSelector
                  id="environment-select"
                  size="sm"
                  allowAllEnvironments={false}
                  value={flow.environment}
                  onChange={value =>
                    dispatch({type: 'set_environment', environment: value})
                  }
                  style={{width: '100%'}}
                  triggerProps={{
                    id: 'environment-select',
                    style: {display: 'flex', flexGrow: 1},
                  }}
                />
              </Flex>
            </ListItem>
            <ListItem>
              <Flex direction="column" gap="lg">
                <label>
                  <Text size="lg">{t('Initial Action')}</Text>
                </label>
                <Flex direction="column" flex="1">
                  {hasProjectId ? (
                    <AssertionStartActionInput
                      action={flow.starting_action}
                      onChange={action =>
                        dispatch({type: 'set_starting_action', starting_action: action})
                      }
                      projectId={flow.project_id}
                    />
                  ) : (
                    <Text italic variant="muted">
                      {t('Choose a Project & Environment first')}
                    </Text>
                  )}
                </Flex>

                <Flex
                  direction="column"
                  gap="md"
                  padding="md"
                  border="primary"
                  radius="lg"
                >
                  <Flex align="center" justify="left" gap="md">
                    <Text variant="promotion">
                      <IconSeer color="pink400" />
                    </Text>
                    <Text size="lg" bold variant="promotion">
                      Seer Suggestion
                    </Text>
                  </Flex>
                  <Text>Use this to start the flow:</Text>
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
                  <Button size="md" icon={<IconAdd color="pink400" />}>
                    <Text variant="promotion">Use Suggestion</Text>
                  </Button>
                </Flex>
              </Flex>
            </ListItem>
          </List>

          {hasStartingAction ? (
            <Flex height="480px">
              <AssertionReplayTable
                action={flow.starting_action}
                projectId={flow.project_id}
                style={{width: '100%'}}
              />
            </Flex>
          ) : null}

          {/* <pre>{JSON.stringify({flow, hasProjectId, hasStartingAction}, null, 2)}</pre> */}

          <Flex gap="lg" direction="row">
            <Button
              priority="primary"
              onClick={() => onSave(flow)}
              disabled={!hasProjectId || !hasStartingAction}
            >
              {t('Save')}
            </Button>
            <Button priority="default" onClick={onClose}>
              {t('Close')}
            </Button>
          </Flex>
        </Flex>
      </Flex>
    </SlideOverPanel>
  );
}

const SlideoutHeaderWrapper = styled('div')`
  padding: ${space(1)} ${space(4)};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const List = styled(Stack)`
  list-style: none;
  padding-left: ${p => p.theme.space['3xl']};
  position: relative;
  counter-reset: numberedList 0;
`;

const ListItem = styled('li')`
  &:before {
    border-radius: 50%;
    position: absolute;
    counter-increment: numberedList;
    content: counter(numberedList);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    left: 0;
    line-height: 1;
    width: ${p => p.theme.fontSize['2xl']};
    height: ${p => p.theme.fontSize['2xl']};
    font-weight: bold;
    font-size: ${p => p.theme.fontSize.sm};
    background-color: ${p => p.theme.yellow300};
    color: ${p => p.theme.black};
  }
`;
