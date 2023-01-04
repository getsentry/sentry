import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import {isEventFromBrowserJavaScriptSDK} from 'sentry/components/events/interfaces/spans/utils';
import {PlatformKey, sourceMaps} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {EntryType, Event, EventTransaction} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {eventHasSourceMaps} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

// This list must always be updated with the documentation.
// Ideally it would be nice if we could send a request validating that this URL exists,
// but due to CORS this is not possible at the moment
const sourceMapsDocLinksPerPlatform = {
  react: 'https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/',
  electron: 'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/',
  cordova: 'https://docs.sentry.io/platforms/javascript/guides/cordova/sourcemaps/',
  'javascript-angularjs':
    'https://docs.sentry.io/platforms/javascript/guides/angular/sourcemaps/',
  'javascript-angular':
    'https://docs.sentry.io/platforms/javascript/guides/angular/sourcemaps/',
  'javascript-ember':
    'https://docs.sentry.io/platforms/javascript/guides/ember/sourcemaps/',
  'javascript-gatsby':
    'https://docs.sentry.io/platforms/javascript/guides/gatsby/sourcemaps/',
  'javascript-vue': 'https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/',
  'javascript-nextjs':
    'https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/',
  'javascript-remix':
    'https://docs.sentry.io/platforms/javascript/guides/remix/sourcemaps/',
  'javascript-svelte':
    'https://docs.sentry.io/platforms/javascript/guides/svelte/sourcemaps/',
};

function isLocalhost(url?: string) {
  if (!url) {
    return false;
  }

  return url.includes('localhost') || url.includes('127.0.0.1');
}

type Props = {
  event: Event;
};

export function SetupSourceMapsAlert({event}: Props) {
  const organization = useOrganization();
  const router = useRouter();

  if (!organization.features?.includes('source-maps-cta')) {
    return null;
  }

  const projectId = router.location.query.project;

  if (!defined(projectId)) {
    return null;
  }

  const eventPlatform = event.platform ?? 'other';
  const eventFromBrowserJavaScriptSDK = isEventFromBrowserJavaScriptSDK(
    event as EventTransaction
  );

  // We would like to filter out all platforms that do not have the concept of source maps
  if (
    !eventFromBrowserJavaScriptSDK &&
    !sourceMaps.includes(eventPlatform as PlatformKey)
  ) {
    return null;
  }

  // If the event already has source maps, we do not want to show this alert
  if (eventHasSourceMaps(event)) {
    return null;
  }

  const url =
    event.entries?.find(entry => entry.type === EntryType.REQUEST)?.data?.url ??
    event.tags.find(tag => tag.key === 'url')?.value;

  const platform = eventFromBrowserJavaScriptSDK
    ? event.sdk?.name?.substring('sentry.javascript.'.length) ?? 'other'
    : eventPlatform;

  // If there is no documentation defined for the sdk and platform, we fall back to the generic one
  const docUrl =
    sourceMapsDocLinksPerPlatform[platform] ??
    sourceMapsDocLinksPerPlatform[eventPlatform] ??
    'https://docs.sentry.io/platforms/javascript/sourcemaps/';

  return (
    <Alert
      type="info"
      showIcon
      trailingItems={
        <Button
          priority="link"
          size="zero"
          href={docUrl}
          external
          onClick={() => {
            trackAdvancedAnalyticsEvent(
              'issue_group_details.stack_traces.setup_source_maps_alert.clicked',
              {
                organization,
                project_id: projectId,
                platform,
              }
            );
          }}
        >
          {t('Upload Source Maps')}
        </Button>
      }
    >
      {isLocalhost(url)
        ? t(
            'In production, you might have minified JS code that makes stack traces hard to read. Sentry can un-minify it for you'
          )
        : t('Sentry can un-minify your code to show you more readable stack traces')}
    </Alert>
  );
}
