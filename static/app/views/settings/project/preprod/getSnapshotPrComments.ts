import type {Project} from 'sentry/types/project';

const ENABLED_KEY = 'sentry:preprod_snapshot_pr_comments_enabled';
const POST_ON_ADDED_KEY = 'sentry:preprod_snapshot_pr_comments_post_on_added';
const POST_ON_REMOVED_KEY = 'sentry:preprod_snapshot_pr_comments_post_on_removed';
const POST_ON_CHANGED_KEY = 'sentry:preprod_snapshot_pr_comments_post_on_changed';
const POST_ON_RENAMED_KEY = 'sentry:preprod_snapshot_pr_comments_post_on_renamed';

export function getSnapshotPrComments(project: Project) {
  const enabled =
    project.preprodSnapshotPrCommentsEnabled ?? project.options?.[ENABLED_KEY] === true;

  const postOnAdded =
    project.preprodSnapshotPrCommentsPostOnAdded ??
    project.options?.[POST_ON_ADDED_KEY] === true;

  const postOnRemoved =
    project.preprodSnapshotPrCommentsPostOnRemoved ??
    project.options?.[POST_ON_REMOVED_KEY] !== false;

  const postOnChanged =
    project.preprodSnapshotPrCommentsPostOnChanged ??
    project.options?.[POST_ON_CHANGED_KEY] !== false;

  const postOnRenamed =
    project.preprodSnapshotPrCommentsPostOnRenamed ??
    project.options?.[POST_ON_RENAMED_KEY] === true;

  return {
    enabled,
    postOnAdded,
    postOnRemoved,
    postOnChanged,
    postOnRenamed,
  };
}
