import {LinkButton, LinkButtonProps} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';

type GithubFeedbackButtonProps = LinkButtonProps & {href: string};

const title = t('Give us feedback on GitHub');

export function GithubFeedbackButton(props: GithubFeedbackButtonProps) {
  return (
    <Tooltip title={title}>
      <LinkButton size="sm" external icon={<IconGithub />} {...props} />
    </Tooltip>
  );
}
