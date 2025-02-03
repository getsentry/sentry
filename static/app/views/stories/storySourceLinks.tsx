import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/button';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {StoryDescriptor} from './useStoriesLoader';

export function StorySourceLinks(props: {story: StoryDescriptor}) {
  return (
    <Fragment>
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
