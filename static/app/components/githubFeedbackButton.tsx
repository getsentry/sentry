import {LinkButton, LinkButtonProps} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';

type GithubFeedbackButtonProps = Omit<LinkButtonProps, 'children' | 'aria-label'> & {
  href: string;
  ['aria-label']?: string;
  label?: string | null;
};

export function GithubFeedbackButton({
  label = t('Give Feedback'),
  ...props
}: GithubFeedbackButtonProps) {
  return (
    <Tooltip title={t('Give us feedback on GitHub')}>
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
