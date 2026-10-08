import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {symbolicated} from 'sentry/data/platformCategories';
import {tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

const DOCS_URL =
  'https://docs.sentry.io/concepts/data-management/filtering/#error-message-filters-do-not-match-deobfuscated-exception-types';

// Inbound filters run before Sentry applies source maps, ProGuard mappings, or
// debug files. On platforms that ship obfuscated code, a pattern copied from an
// issue then misses the raw type and message the filter actually checks.
export function ErrorMessageFilterWarning({
  project,
}: {
  project: Pick<Project, 'platform'>;
}) {
  if (!project.platform || !symbolicated.includes(project.platform)) {
    return null;
  }

  return (
    <Alert variant="warning">
      {tct(
        'Filters check the error type and message as they arrive, before Sentry applies source maps, ProGuard mappings, or debug files. What you see in an issue can differ from what the filter checks. [link:Learn how to match the incoming error.]',
        {link: <ExternalLink href={DOCS_URL} />}
      )}
    </Alert>
  );
}
