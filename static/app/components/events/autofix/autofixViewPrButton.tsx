import {LinkButton} from 'sentry/components/button';
import {IconOpen} from 'sentry/icons';

export function AutofixViewPrButton({
  repoName,
  prUrl,
}: {
  prUrl: string;
  repoName: string;
}) {
  return (
    <LinkButton
      size="xs"
      priority="primary"
      icon={<IconOpen size="xs" />}
      href={prUrl}
      external
    >
      View PR in {repoName}
    </LinkButton>
  );
}
