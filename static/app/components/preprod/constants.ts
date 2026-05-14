/**
 * Allowed search keys for the builds dashboard.
 * Keep in sync with src/sentry/preprod/api/endpoints/builds.py allowed_keys
 */
export const MOBILE_BUILDS_ALLOWED_KEYS = [
  'app_id',
  'app_name',
  'build_configuration_name',
  'build_number',
  'build_version',
  'distribution_error_code',
  'download_count',
  'download_size',
  'git_base_ref',
  'git_base_sha',
  'git_head_ref',
  'git_head_sha',
  'git_pr_number',
  'image_count',
  'images_added',
  'images_changed',
  'images_removed',
  'images_renamed',
  'images_skipped',
  'images_unchanged',
  'install_size',
  'installable',
  'platform_name',
];

export const SNAPSHOT_ALLOWED_KEYS = [
  'app_id',
  'git_base_ref',
  'git_base_sha',
  'git_head_ref',
  'git_head_sha',
  'git_pr_number',
  'image_count',
  'images_added',
  'images_changed',
  'images_removed',
  'images_renamed',
  'images_skipped',
  'images_unchanged',
];
