import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {DateTime} from 'sentry/components/dateTime';
import {IconGithub} from 'sentry/icons';
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
    <Fragment>
      {committerDate ? (
        <LastEdited>
          Last Edited: <DateTime date={committerDate} />
        </LastEdited>
      ) : null}
      <LinkButton
        href={`https://github.com/getsentry/sentry/blob/master/static/${props.story.filename}`}
        external
        icon={<IconGithub />}
        size="xs"
        aria-label={t('View on GitHub')}
      >
        {t('View')}
      </LinkButton>
      <LinkButton
        href={`https://github.com/getsentry/sentry/edit/master/static/${props.story.filename}`}
        external
        icon={<IconGithub />}
        size="xs"
        aria-label={t('Edit on GitHub')}
      >
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}

const LastEdited = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.muted};
`;
