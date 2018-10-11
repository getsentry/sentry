const TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
};

export const PROMOTED_TAGS = [
  {name: 'tags[level]', type: TYPES.STRING},
  {name: 'tags[logger]', type: TYPES.STRING},
  {name: 'tags[server_name]', type: TYPES.STRING},
  {name: 'tags[transaction]', type: TYPES.STRING},
  {name: 'tags[environment]', type: TYPES.STRING},
  {name: 'tags[site]', type: TYPES.STRING},
  {name: 'tags[url]', type: TYPES.STRING},
  {name: 'tags[app_device]', type: TYPES.STRING},
  {name: 'tags[device]', type: TYPES.STRING},
  {name: 'tags[device_family]', type: TYPES.STRING},
  {name: 'tags[runtime]', type: TYPES.STRING},
  {name: 'tags[runtime_name]', type: TYPES.STRING},
  {name: 'tags[browser]', type: TYPES.STRING},
  {name: 'tags[browser_name]', type: TYPES.STRING},
  {name: 'tags[os]', type: TYPES.STRING},
  {name: 'tags[os_name]', type: TYPES.STRING},
  {name: 'tags[os_rooted]', type: TYPES.BOOLEAN},
  {name: 'tags[sentry:release]', type: TYPES.STRING},
];

// All tags are assumed to be strings, except the following
export const SPECIAL_TAGS = {
  'tags[os_rooted]': TYPES.BOOLEAN,
};

export const COLUMNS = [
  {name: 'event_id', type: TYPES.STRING},
  {name: 'project_id', type: TYPES.STRING},
  {name: 'project_name', type: TYPES.STRING}, // Not a snuba column
  {name: 'platform', type: TYPES.STRING},
  {name: 'message', type: TYPES.STRING},
  {name: 'primary_hash', type: TYPES.STRING},
  {name: 'timestamp', type: TYPES.STRING}, // TODO: handling datetime as string for now
  {name: 'received', type: TYPES.STRING}, // TODO: handling datetime as string for now

  {name: 'user_id', type: TYPES.STRING},
  {name: 'username', type: TYPES.STRING},
  {name: 'email', type: TYPES.STRING},
  {name: 'ip_address', type: TYPES.STRING},

  {name: 'sdk_name', type: TYPES.STRING},
  {name: 'sdk_version', type: TYPES.STRING},
  {name: 'tags_key', type: TYPES.STRING},
  {name: 'tags_value', type: TYPES.STRING},
  {name: 'contexts.key', type: TYPES.STRING},
  {name: 'contexts.value', type: TYPES.STRING},
  {name: 'http_method', type: TYPES.STRING},
  {name: 'http_referer', type: TYPES.STRING},
  {name: 'os_build', type: TYPES.STRING},
  {name: 'os_kernel_version', type: TYPES.STRING},
  {name: 'device_name', type: TYPES.STRING},
  {name: 'device_brand', type: TYPES.STRING},
  {name: 'device_locale', type: TYPES.STRING},
  {name: 'device_uuid', type: TYPES.STRING},
  {name: 'device_model_id', type: TYPES.STRING},
  {name: 'device_arch', type: TYPES.STRING},
  {name: 'device_battery_level', type: TYPES.NUMBER},
  {name: 'device_orientation', type: TYPES.STRING},
  {name: 'device_simulator', type: TYPES.STRING},
  {name: 'device_online', type: TYPES.STRING},
  {name: 'device_charging', type: TYPES.STRING},
  {name: 'exception_stacks.type', type: TYPES.STRING},
  {name: 'exception_stacks.value', type: TYPES.STRING},
  {name: 'exception_stacks.mechanism_type', type: TYPES.STRING},
  {name: 'exception_stacks.mechanism_handled', type: TYPES.STRING},
  {name: 'exception_frames.abs_path', type: TYPES.STRING},
  {name: 'exception_frames.filename', type: TYPES.STRING},
  {name: 'exception_frames.package', type: TYPES.STRING},
  {name: 'exception_frames.module', type: TYPES.STRING},
  {name: 'exception_frames.function', type: TYPES.STRING},
  {name: 'exception_frames.in_app', type: TYPES.BOOLEAN},
  {name: 'exception_frames.colno', type: TYPES.STRING},
  {name: 'exception_frames.lineno', type: TYPES.STRING},
  {name: 'exception_frames.stack_level', type: TYPES.STRING},
];

export const CONDITION_OPERATORS = [
  '>',
  '<',
  '>=',
  '<=',
  '=',
  '!=',
  // 'IN', commented out since condition input doesn't support arrays yet :(
  'IS NULL',
  'IS NOT NULL',
  'LIKE',
  'NOT LIKE',
];

export const ARRAY_FIELD_PREFIXES = ['exception_stacks', 'exception_frames'];

export const NUMBER_OF_SERIES_BY_DAY = 10;
