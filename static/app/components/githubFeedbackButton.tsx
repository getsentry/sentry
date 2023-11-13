import {LinkButton, LinkButtonProps} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';

type GithubFeedbackButtonProps = Omit<LinkButtonProps, 'children' | 'aria-label'> & {
  href: string;
  ['aria-label']?: string;
  label?: string | null;
  title?: string | null;
};

export function GithubFeedbackButton({
  label = t('Give Feedback'),
  title = t('Give us feedback on GitHub'),
  ...props
}: GithubFeedbackButtonProps) {
  return (
    <Tooltip title={title}>
      <LinkButton
        aria-label={label ?? t('Give Feedback')}
        size="sm"
        external
        icon={<IconGithub />}
        {...props}
      >
        {label}
      </LinkButton>
    </Tooltip>
  );
}
