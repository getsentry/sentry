import {Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

interface InboxIssueSeenProps {
  date: string;
  label: string;
  project: Pick<Project, 'id' | 'slug'>;
  releaseVersion?: string;
}

export function InboxIssueSeen({
  date,
  label,
  project,
  releaseVersion,
}: InboxIssueSeenProps) {
  const organization = useOrganization();

  if (!date) {
    return <Text variant="muted">{t('N/A')}</Text>;
  }

  const time = (
    <TimeSince date={date} unitStyle="short" tooltipPrefix={label} variant="primary" />
  );

  return (
    <Text variant="muted" wordBreak="break-word">
      {releaseVersion
        ? tct('[time] in release [release]', {
            time,
            release: (
              <VersionHoverCard
                organization={organization}
                projectSlug={project.slug}
                releaseVersion={releaseVersion}
                containerDisplayMode="inline"
              >
                <Text variant="muted" underline="dotted">
                  {textProps => (
                    <Version
                      {...textProps}
                      version={releaseVersion}
                      projectId={project.id}
                      shouldWrapText
                    />
                  )}
                </Text>
              </VersionHoverCard>
            ),
          })
        : time}
    </Text>
  );
}
