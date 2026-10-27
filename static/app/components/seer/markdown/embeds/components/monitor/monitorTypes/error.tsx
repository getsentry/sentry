import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {ErrorDetector} from 'sentry/types/workflowEngine/detectors';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';

/**
 * Error detectors have no per-detector config on the read serializer (grouping,
 * ownership, and priority all come from project-level settings), so this mirrors
 * the same generic copy rendered by the sidebar of
 * views/detectors/components/details/error/index.tsx.
 */
export function ErrorMonitor({
  detector,
  organization,
}: {
  detector: ErrorDetector;
  organization: Organization;
}) {
  const project = useProjectFromId({project_id: detector.projectId});

  return (
    <Stack gap="sm">
      <Heading as="h4" size="xs">
        {t('Rules')}
      </Heading>
      <Stack gap="xs">
        <Text variant="muted">{t('Detect')}</Text>
        <Text as="p">
          {tct(
            'All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link:read the docs].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/concepts/data-management/event-grouping/" />
              ),
            }
          )}
        </Text>
      </Stack>
      <Stack gap="xs">
        <Text variant="muted">{t('Assign')}</Text>
        <Text as="p">
          {project
            ? tct(
                'Sentry will attempt to automatically assign new issues based on [link:Ownership Rules].',
                {
                  link: (
                    <Link
                      to={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
                    />
                  ),
                }
              )
            : t(
                'Sentry will attempt to automatically assign new issues based on Ownership Rules.'
              )}
        </Text>
      </Stack>
      <Stack gap="xs">
        <Text variant="muted">{t('Prioritize')}</Text>
        <Text as="p">
          {tct(
            'New error issues are prioritized based on log level. [link:Learn more about Issue Priority].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/issues/issue-priority/" />
              ),
            }
          )}
        </Text>
      </Stack>
    </Stack>
  );
}
