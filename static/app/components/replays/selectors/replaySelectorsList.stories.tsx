import {useState} from 'react';
import {ClassNames} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout/flex';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectPicker from 'sentry/components/replays/player/__stories__/projectPicker';
import ReplayCrumbList from 'sentry/components/replays/selectors/replaySelectorsList';
import * as Storybook from 'sentry/stories';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {
  DeadRageSelectorItem,
  DeadRageSelectorListResponse,
} from 'sentry/views/replays/types';

export default Storybook.story('ReplaySelectorsList', story => {
  story('Rendered', () => {
    const organization = useOrganization();
    const [project, setProject] = useState<string | undefined>();
    const [selected, setSelected] = useState<DeadRageSelectorItem | undefined>();

    const queryResult = useInfiniteApiQuery<DeadRageSelectorListResponse>({
      queryKey: [
        'infinite',
        `/organizations/${organization.slug}/replay-selectors/`,
        {
          query: {
            per_page: 50,
            project,
            statsPeriod: '90d',
          },
        },
      ],
    });

    return (
      <Flex direction="column" gap="md">
        <pre>Selected: {JSON.stringify(selected, null, 2)}</pre>
        <Flex gap="sm">
          <ProjectPicker project={project} onChange={setProject} />
        </Flex>
        <Flex style={{height: 500}}>
          <Flex direction="column" gap="md" flex="1">
            <ReplayCrumbList onSelect={setSelected} queryResult={queryResult} />
          </Flex>
        </Flex>
      </Flex>
    );
  });

  story('Hovercard', () => {
    const organization = useOrganization();
    const [project, setProject] = useState<string | undefined>();
    const [selected, setSelected] = useState<DeadRageSelectorItem | undefined>();

    const queryResult = useInfiniteApiQuery<DeadRageSelectorListResponse>({
      queryKey: [
        'infinite',
        `/organizations/${organization.slug}/replay-selectors/`,
        {
          query: {
            per_page: 50,
            project,
            statsPeriod: '90d',
          },
        },
      ],
    });

    return (
      <ClassNames>
        {({css}) => (
          <Hovercard
            body={
              <Flex direction="column" gap="md">
                <Flex gap="sm">
                  <ProjectPicker project={project} onChange={setProject} />
                </Flex>
                <Flex style={{height: 500}}>
                  <Flex direction="column" gap="md" flex="1">
                    <ReplayCrumbList onSelect={setSelected} queryResult={queryResult} />
                  </Flex>
                </Flex>
              </Flex>
            }
            containerClassName={css`
              width: max-content;
            `}
          >
            <pre>Selected: {JSON.stringify(selected, null, 2)}</pre>
          </Hovercard>
        )}
      </ClassNames>
    );
  });
});
