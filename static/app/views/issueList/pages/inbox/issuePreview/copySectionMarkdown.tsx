import {Button} from '@sentry/scraps/button';

import {
  type AutofixSection,
  getAutofixArtifactFromSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {artifactToMarkdown} from 'sentry/components/events/autofix/v3/utils';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

export function CopySectionMarkdown({section}: {section: AutofixSection}) {
  const {copy} = useCopyToClipboard();
  const artifact =
    section.status === 'completed' ? getAutofixArtifactFromSection(section) : null;
  const markdown = artifact ? artifactToMarkdown(artifact) : null;

  return markdown ? (
    <Button
      size="xs"
      variant="transparent"
      icon={<IconCopy size="xs" />}
      aria-label={t('Copy as Markdown')}
      tooltipProps={{title: t('Copy as Markdown')}}
      onClick={() => copy(markdown, {successMessage: t('Copied to clipboard.')})}
    />
  ) : null;
}
