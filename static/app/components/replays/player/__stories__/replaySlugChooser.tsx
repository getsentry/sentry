import {Fragment, useState, type ReactNode} from 'react';
import {ClassNames} from '@emotion/react';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {Hovercard} from 'sentry/components/hovercard';
import ReplayList from 'sentry/components/replays/list/__stories__/replayList';
import EnvironmentPicker from 'sentry/components/replays/player/__stories__/environmentPicker';
import ProjectPicker from 'sentry/components/replays/player/__stories__/projectPicker';
import Providers from 'sentry/components/replays/player/__stories__/providers';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useReplayListQueryKey from 'sentry/utils/replays/hooks/useReplayListQueryKey';
import useOrganization from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  children: ReactNode;
}

export default function ReplaySlugChooser({children}: Props) {
  const organization = useOrganization();
  const [project, setProject] = useState<string | undefined>();
  const [environment, setEnvironment] = useState<string | undefined>();
  const [replaySlug, setReplaySlug] = useSessionStorage('stories:replaySlug', '');

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

  const input = (
    <Flex direction="row" gap="sm">
      <ProjectPicker project={project} onChange={setProject} />
      <EnvironmentPicker
        project={project}
        environment={environment}
        onChange={setEnvironment}
      />

      <ClassNames>
        {({css}) => (
          <Hovercard
            body={
              <Flex direction="column" gap="md">
                <Flex height="500px">
                  <Flex direction="column" gap="md" flex="1">
                    <ReplayList onSelect={setReplaySlug} queryResult={queryResult} />
                  </Flex>
                </Flex>
              </Flex>
            }
            containerClassName={css`
              width: max-content;
            `}
          >
            <Flex direction="row" gap="sm" wrap="nowrap" align="center">
              <Text wrap="nowrap">Replay ID:</Text>
              <InputGroup.Input
                value={replaySlug}
                onChange={event => {
                  setReplaySlug(event.target.value);
                }}
                placeholder="Paste a replaySlug"
                css={css`
                  font-variant-numeric: tabular-nums;
                  min-width: calc(32ch + 1em);
                `}
                size="sm"
              />
            </Flex>
          </Hovercard>
        )}
      </ClassNames>
    </Flex>
  );

  return (
    <Fragment>
      {input}
      {replaySlug ? <Content replaySlug={replaySlug}>{children}</Content> : null}
    </Fragment>
  );
}

function Content({children, replaySlug}: {children: ReactNode; replaySlug: string}) {
  const organization = useOrganization();
  const readerResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
    clipWindow: undefined,
  });
  return (
    <ReplayLoadingState readerResult={readerResult}>
      {({replay}) => <Providers replay={replay}>{children}</Providers>}
    </ReplayLoadingState>
  );
}
