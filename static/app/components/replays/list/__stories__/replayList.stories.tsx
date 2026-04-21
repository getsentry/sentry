import {useState} from 'react';
import {ClassNames} from '@emotion/react';
import {useInfiniteQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';

import {Hovercard} from 'sentry/components/hovercard';
import {ReplayList} from 'sentry/components/replays/list/__stories__/replayList';
import {EnvironmentPicker} from 'sentry/components/replays/player/__stories__/environmentPicker';
import {ProjectPicker} from 'sentry/components/replays/player/__stories__/projectPicker';
import * as Storybook from 'sentry/stories';
import {replayListInfiniteApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

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

    const queryResult = useInfiniteQuery(
      replayListInfiniteApiOptions({
        options: {query},
        organization,
        queryReferrer: 'replayList',
      })
    );

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
        <Flex height="500px">
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
              <Flex direction="column" gap="md">
                <Flex gap="sm">
                  <ProjectPicker project={project} onChange={setProject} />
                  <EnvironmentPicker
                    project={project}
                    environment={environment}
                    onChange={setEnvironment}
                  />
                </Flex>
                <Flex height="500px">
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
