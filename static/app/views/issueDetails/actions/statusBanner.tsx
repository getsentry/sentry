import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {GroupStatus, GroupSubstatus, ProgressState} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {ActivityResolutionReason} from 'sentry/views/issueDetails/actions/resolutionReason';
import {getArchiveDetails} from 'sentry/views/issueDetails/activitySection/activityLineItem/archiveDetails';
import {ActivityProgressMarker} from 'sentry/views/issueDetails/activitySection/activityLineItem/progressMarker/progressMarker';

type StatusGroup = Extract<Group, {status: GroupStatus.IGNORED | GroupStatus.RESOLVED}>;

interface StatusBannerProps {
  group: Group;
  project: Project;
  resolvedCopy?: React.ReactNode;
}

export function StatusBanner({group, project, resolvedCopy}: StatusBannerProps) {
  if (group.status !== GroupStatus.RESOLVED && group.status !== GroupStatus.IGNORED) {
    return null;
  }

  return (
    <ActivityStatusBanner group={group} project={project} resolvedCopy={resolvedCopy} />
  );
}

function ActivityStatusBanner({
  group,
  project,
  resolvedCopy,
}: StatusBannerProps & {
  group: StatusGroup;
}) {
  const isResolved = group.status === GroupStatus.RESOLVED;

  return (
    <StatusBannerFrame
      markerLabel={isResolved ? undefined : t('Archived')}
      markerState={isResolved ? ProgressState.FIX_APPLIED : ProgressState.ASSIGNED}
      title={isResolved ? resolvedCopy || t('Resolved') : t('Archived')}
    >
      {isResolved ? (
        <ActivityResolutionReason
          statusDetails={group.statusDetails}
          activities={group.activity}
          project={project}
        />
      ) : (
        <ActivityArchiveReason group={group} />
      )}
    </StatusBannerFrame>
  );
}

interface StatusBannerFrameProps {
  children: React.ReactNode;
  markerState: ProgressState;
  title: React.ReactNode;
  markerLabel?: string;
}

export function StatusBannerFrame({
  children,
  markerLabel,
  markerState,
  title,
}: StatusBannerFrameProps) {
  return (
    <Flex align="center" gap="sm">
      <ActivityProgressMarker label={markerLabel} state={markerState} />
      <Stack gap="0">
        <Text as="div" bold density="compressed" size="lg">
          {title}
        </Text>
        <Text as="div" density="comfortable" size="md">
          {children}
        </Text>
      </Stack>
    </Flex>
  );
}

function ActivityArchiveReason({
  group,
}: {
  group: Extract<Group, {status: GroupStatus.IGNORED}>;
}) {
  const {actor} = group.statusDetails;
  const archiveData =
    group.substatus === GroupSubstatus.ARCHIVED_UNTIL_ESCALATING
      ? {ignoreUntilEscalating: true}
      : group.statusDetails;
  const details = getArchiveDetails(archiveData, group.issueCategory) ?? t('forever');

  return actor
    ? tct('[actor] archived [details]', {actor: actor.name, details})
    : tct('Archived [details]', {details});
}
