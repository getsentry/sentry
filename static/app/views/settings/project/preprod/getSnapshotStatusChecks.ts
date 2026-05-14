import type {DetailedProject} from 'sentry/types/project';

const ENABLED_KEY = 'sentry:preprod_snapshot_status_checks_enabled';
const FAIL_ON_ADDED_KEY = 'sentry:preprod_snapshot_status_checks_fail_on_added';
const FAIL_ON_REMOVED_KEY = 'sentry:preprod_snapshot_status_checks_fail_on_removed';
const FAIL_ON_CHANGED_KEY = 'sentry:preprod_snapshot_status_checks_fail_on_changed';
const FAIL_ON_RENAMED_KEY = 'sentry:preprod_snapshot_status_checks_fail_on_renamed';

export function getSnapshotStatusChecks(project: DetailedProject) {
  const enabled =
    project.preprodSnapshotStatusChecksEnabled ??
    project.options?.[ENABLED_KEY] !== false;

  const failOnAdded =
    project.preprodSnapshotStatusChecksFailOnAdded ??
    project.options?.[FAIL_ON_ADDED_KEY] === true;

  const failOnRemoved =
    project.preprodSnapshotStatusChecksFailOnRemoved ??
    project.options?.[FAIL_ON_REMOVED_KEY] !== false;

  const failOnChanged =
    project.preprodSnapshotStatusChecksFailOnChanged ??
    project.options?.[FAIL_ON_CHANGED_KEY] !== false;

  const failOnRenamed =
    project.preprodSnapshotStatusChecksFailOnRenamed ??
    project.options?.[FAIL_ON_RENAMED_KEY] === true;

  return {
    enabled,
    failOnAdded,
    failOnRemoved,
    failOnChanged,
    failOnRenamed,
  };
}
