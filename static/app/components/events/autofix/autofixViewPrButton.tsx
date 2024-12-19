import {LinkButton} from 'sentry/components/button';
import {IconOpen} from 'sentry/icons';

export function AutofixViewPrButton({
  repoName,
  prUrl,
  isPrimary = true,
}: {
  prUrl: string;
  repoName: string;
  isPrimary?: boolean;
}) {
  return (
    <LinkButton
      size="xs"
      priority={isPrimary ? 'primary' : 'default'}
      icon={<IconOpen size="xs" />}
      href={prUrl}
      external
    >
      View PR in {repoName}
    </LinkButton>
  );
}
