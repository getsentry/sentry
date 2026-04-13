import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  getSourceMapsDocLinks,
  projectPlatformToDocsMap,
} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

interface ProblemSectionProps {
  project: Project;
}

export function ProblemSection({project}: ProblemSectionProps) {
  const docsSegment =
    (project.platform && projectPlatformToDocsMap[project.platform]) ?? 'javascript';
  const docLinks = getSourceMapsDocLinks(docsSegment);

  return (
    <Stack gap="lg" padding="lg">
      <Heading as="h3">{t('Problem')}</Heading>
      <Text>
        {t(
          "Your source maps aren't configured correctly, so stack traces will show minified code instead of your original source. Fix this to see the exact file, line, and function causing the error."
        )}
      </Text>
      <div>
        <LinkButton size="sm" icon={<IconInfo />} external href={docLinks.sourcemaps}>
          {t('Why configure source maps?')}
        </LinkButton>
      </div>
    </Stack>
  );
}
