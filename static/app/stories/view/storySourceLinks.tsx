import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {DateTime} from 'sentry/components/dateTime';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useQuery} from 'sentry/utils/queryClient';

import {useStory} from './useStory';

type GithubCommitResponse = Array<{commit: {committer: {date: string}}}>;

export function StorySourceLinks() {
  const {story} = useStory();
  const {data} = useQuery<GithubCommitResponse, Error, GithubCommitResponse, [string]>({
    queryKey: [
      `https://api.github.com/repos/getsentry/sentry/commits?&page=1per_page=1&path=static/${story.filename}`,
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
    <Flex align="center" justify="between" gap="md">
      <LinkButton
        priority="transparent"
        href={`https://github.com/getsentry/sentry/edit/master/static/${story.filename}`}
        external
        icon={<IconEdit />}
        size="xs"
      >
        {t('Edit on GitHub')}
      </LinkButton>

      {committerDate ? (
        <LastEdited>
          Last Edited: <DateTime date={committerDate} />
        </LastEdited>
      ) : null}
    </Flex>
  );
}

const LastEdited = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;
