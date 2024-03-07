import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export const TAGS_DOCS_LINK = `https://docs.sentry.io/platform-redirect/?next=/enriching-events/tags`;

export enum TagFilter {
  ALL = 'All',
  CUSTOM = 'Custom',
  CLIENT = 'Client',
  APPLICATION = 'Application',
  OTHER = 'Other',
}

export const TagFilterData = {
  [TagFilter.APPLICATION]: new Set([
    // AppContext
    'app',
    'app.app_start_time',
    'app.device_app_hash',
    'app.build_type',
    'app.app_identifier',
    'app.app_name',
    'app.app_version',
    'app.app_build',
    'app.app_memory',
    'app.in_foreground',
    // Runtime Context
    'runtime',
    'runtime.context',
    'runtime.version',
    'runtime.build',
    // Manual
    'release',
    'dist',
    'environment',
    'platform',
    'app.identifier',
    'hostname',
    'server_name',
    'site',
  ]),
  [TagFilter.CLIENT]: new Set([
    // BrowserContext
    'browser',
    'browser.name',
    'browser.version',
    // Device Context
    'device',
    'device.family',
    'device.model',
    'device.model_id',
    'device.arch',
    'device.battery_level',
    'device.orientation',
    'device.manufacturer',
    'device.brand',
    'device.screen_resolution',
    'device.screen_width_pixels',
    'device.screen_height_pixels',
    'device.screen_density',
    'device.screen_dpi',
    'device.online',
    'device.charging',
    'device.low_memory',
    'device.simulator',
    'device.memory_size',
    'device.free_memory',
    'device.usable_memory',
    // OS Context
    'client_os',
    'client_os.name',
    'client_os.version',
    'client_os.build',
    'client_os.kernel_version',
    'client_os.rooted',
    'client_os.raw_description',
    'os',
    'os.name',
    'os.version',
    'os.build',
    'os.kernel_version',
    'os.rooted',
    'os.raw_description',
    'os.raw_description',
    // Manual
    'user',
    'mobile',
    'device.class',
    'site',
    'url',
  ]),
  [TagFilter.OTHER]: new Set([
    /* Common */
    'handled',
    'level',
    'mechanism',
    'url',

    /* tags.insert(...) */
    'hostname',
    'server_name',
    'site',
    'transaction.start',
    'transaction.end',
    // 'app.identifier',

    /* SpanTagKey in Relay */
    // 'release',
    // 'user',
    // 'environment',
    'transaction',
    'transaction.method',
    'transaction.op',
    // 'mobile',
    // 'device.class',
    // 'browser.name',
    'sdk.name',
    'sdk.version',
    // 'platform',
    'action',
    'category',
    'description',
    'domain',
    'raw_domain',
    'group',
    'http.decoded_response_content_length',
    'http.response_content_length',
    'http.response_transfer_size',
    'resource.render_blocking_status',
    'op',
    'status_code',
    'system',
    'ttfd',
    'ttid',
    'file_extension',
    'main_thread',
    // 'os.name',
    'app_start_type',
    'replay_id',

    /* CommonTag in Relay */
    // 'release',
    // 'dist',
    // 'environment',
    // 'platform',
    'transaction',
    'transaction.status',
    'transaction.op',
    'http.method',
    'http.status_code',
    // 'browser.name',
    // 'os.name',
    'geo.country_code',
    // 'device.class',
  ]),
};

export const SentryDefaultTags = Object.values(TagFilterData).reduce(
  // TODO: result.union(s) when Set.prototype.union is Baseline
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/union
  (result, s) => new Set([...result, ...s]),
  new Set([])
);

export function useHasNewTagsUI() {
  const location = useLocation();
  const organization = useOrganization();
  return (
    location.query.tagsTree === '1' ||
    organization.features.includes('event-tags-tree-ui')
  );
}
