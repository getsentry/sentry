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
  'download_count',
  'download_size',
  'git_base_ref',
  'git_base_sha',
  'git_head_ref',
  'git_head_sha',
  'git_pr_number',
  'install_size',
  'installable',
  'platform_name',
];
