import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {DateTime} from 'sentry/components/dateTime';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useQuery} from 'sentry/utils/queryClient';

import type {StoryDescriptor} from './useStoriesLoader';

type GithubCommitResponse = Array<{commit: {committer: {date: string}}}>;

export function StorySourceLinks(props: {story: StoryDescriptor}) {
  const {data} = useQuery<GithubCommitResponse, Error, GithubCommitResponse, [string]>({
    queryKey: [
      `https://api.github.com/repos/getsentry/sentry/commits?&page=1per_page=1&path=static/${props.story.filename}`,
    ],
    queryFn: async ({queryKey}) => {
      const [url] = queryKey;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
  });

  const committerDate = data?.[0]?.commit.committer.date;

  return (
    <Flex align="center" justify="space-between" flex={1}>
      <LinkButton
        priority="transparent"
        href={`https://github.com/getsentry/sentry/edit/master/static/${props.story.filename}`}
        external
        icon={<IconEdit />}
        size="xs"
        aria-label={t('Edit on GitHub')}
      >
        {t('Edit on GitHub')}
      </LinkButton>

      <LastEdited>
        Last Edited: {committerDate ? <DateTime date={committerDate} /> : 'Unknown'}
      </LastEdited>
    </Flex>
  );
}

const LastEdited = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.tokens.content.muted};
`;
