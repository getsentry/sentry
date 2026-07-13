import {useState} from 'react';
import {ClassNames} from '@emotion/react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {Flex, Stack} from '@sentry/scraps/layout';

import {Hovercard} from 'sentry/components/hovercard';
import {ReplayList} from 'sentry/components/replays/list/__stories__/replayList';
import {EnvironmentPicker} from 'sentry/components/replays/player/__stories__/environmentPicker';
import * as Storybook from 'sentry/stories';
import {replayListInfiniteApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export default Storybook.story('ReplayList', story => {
  story('Rendered', () => {
    const organization = useOrganization();
    const [project, setProject] = useQueryState('project', parseAsString);
    const [environment, setEnvironment] = useQueryState('environment', parseAsString);
    const [replayId, setReplayId] = useState<string | undefined>();

    const query = {
      environment: environment ? [environment] : undefined,
      project: project ? [project] : undefined,
      sort: '-started_at',
      statsPeriod: '90d',
    };

    const queryResult = useInfiniteQuery(
      replayListInfiniteApiOptions({
        options: {query},
        organization,
        queryReferrer: 'replayList',
      })
    );

    return (
      <Stack gap="md">
        Selected Replay: {replayId}
        <Flex gap="sm">
          <Storybook.SelectProject projectSlug={project} setProjectSlug={setProject} />

          <EnvironmentPicker
            project={project}
            environment={environment}
            onChange={setEnvironment}
          />
        </Flex>
        <Flex height="500px">
          <Stack gap="md" flex="1">
            <ReplayList onSelect={setReplayId} queryResult={queryResult} />
          </Stack>
        </Flex>
      </Stack>
    );
  });

  story('Hovercard', () => {
    const organization = useOrganization();
    const [project, setProject] = useQueryState('project', parseAsString);
    const [environment, setEnvironment] = useQueryState('environment', parseAsString);
    const [replayId, setReplayId] = useState<string | undefined>();

    const query = {
      environment: environment ? [environment] : undefined,
      project: project ? [project] : undefined,
      sort: '-started_at',
      statsPeriod: '90d',
    };

    const queryResult = useInfiniteQuery(
      replayListInfiniteApiOptions({
        options: {query},
        organization,
        queryReferrer: 'replayList',
      })
    );

    return (
      <ClassNames>
        {({css}) => (
          <Hovercard
            body={
              <Stack gap="md">
                <Flex gap="sm">
                  <Storybook.SelectProject
                    projectSlug={project}
                    setProjectSlug={setProject}
                  />
                  <EnvironmentPicker
                    project={project}
                    environment={environment}
                    onChange={setEnvironment}
                  />
                </Flex>
                <Flex height="500px">
                  <Stack gap="md" flex="1">
                    <ReplayList onSelect={setReplayId} queryResult={queryResult} />
                  </Stack>
                </Flex>
              </Stack>
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
