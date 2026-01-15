import {useState} from 'react';
import {ClassNames} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout/flex';
import {Hovercard} from 'sentry/components/hovercard';
import ReplayList from 'sentry/components/replays/list/__stories__/replayList';
import EnvironmentPicker from 'sentry/components/replays/player/__stories__/environmentPicker';
import ProjectPicker from 'sentry/components/replays/player/__stories__/projectPicker';
import * as Storybook from 'sentry/stories';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayListRecord} from 'sentry/views/replays/types';

export default Storybook.story('ReplayList', story => {
  story('Rendered', () => {
    const organization = useOrganization();
    const [project, setProject] = useState<string | undefined>();
    const [environment, setEnvironment] = useState<string | undefined>();
    const [replayId, setReplayId] = useState<string | undefined>();

    const query = {
      environment: environment ? [environment] : undefined,
      project: project ? [project] : undefined,
      sort: '-started_at',
      statsPeriod: '90d',
    };

    const listQueryKey = useReplayListQueryKey({
      options: {query},
      organization,
      queryReferrer: 'replayList',
    });
    const queryResult = useInfiniteApiQuery<{data: ReplayListRecord[]}>({
      queryKey: ['infinite', ...(listQueryKey ?? '')],
      enabled: Boolean(listQueryKey),
    });

    return (
      <Flex direction="column" gap="md">
        Selected Replay: {replayId}
        <Flex gap="sm">
          <ProjectPicker project={project} onChange={setProject} />
          <EnvironmentPicker
            project={project}
            environment={environment}
            onChange={setEnvironment}
          />
        </Flex>
        <Flex height={500}>
          <Flex direction="column" gap="md" flex="1">
            <ReplayList onSelect={setReplayId} queryResult={queryResult} />
          </Flex>
        </Flex>
      </Flex>
    );
  });

  story('Hovercard', () => {
    const organization = useOrganization();

    const [project, setProject] = useState<string | undefined>();
    const [environment, setEnvironment] = useState<string | undefined>();

    const [replayId, setReplayId] = useState<string | undefined>();

    const query = {
      environment: environment ? [environment] : undefined,
      project: project ? [project] : undefined,
      sort: '-started_at',
      statsPeriod: '90d',
    };

    const listQueryKey = useReplayListQueryKey({
      options: {query},
      organization,
      queryReferrer: 'replayList',
    });
    const queryResult = useInfiniteApiQuery<{data: ReplayListRecord[]}>({
      queryKey: ['infinite', ...(listQueryKey ?? '')],
      enabled: Boolean(listQueryKey),
    });

    return (
      <ClassNames>
        {({css}) => (
          <Hovercard
            body={
              <Flex direction="column" gap="md">
                <Flex gap="sm">
                  <ProjectPicker project={project} onChange={setProject} />
                  <EnvironmentPicker
                    project={project}
                    environment={environment}
                    onChange={setEnvironment}
                  />
                </Flex>
                <Flex height={500}>
                  <Flex direction="column" gap="md" flex="1">
                    <ReplayList onSelect={setReplayId} queryResult={queryResult} />
                  </Flex>
                </Flex>
              </Flex>
            }
            containerClassName={css`
              width: max-content;
            `}
          >
            Selected Replay: {replayId}
          </Hovercard>
        )}
      </ClassNames>
    );
  });
});
