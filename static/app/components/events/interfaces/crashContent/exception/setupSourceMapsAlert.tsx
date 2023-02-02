import {Alert} from 'sentry/components/alert';
import {isEventFromBrowserJavaScriptSDK} from 'sentry/components/events/interfaces/spans/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import {PlatformKey, sourceMaps} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {
  EntryException,
  EntryType,
  Event,
  EventTransaction,
  Organization,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {eventHasSourceMaps} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import {isFrameFilenamePathlike} from './utils';

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

export function shouldDisplaySetupSourceMapsAlert(
  organization: Organization,
  projectId: string | undefined,
  event: Event | undefined
): boolean {
  if (!defined(projectId) || !defined(event)) {
    return false;
  }

  if (!organization.features?.includes('source-maps-cta')) {
    return false;
  }

  const eventPlatform = event?.platform ?? 'other';
  const eventFromBrowserJavaScriptSDK = isEventFromBrowserJavaScriptSDK(
    event as EventTransaction
  );
  const exceptionEntry = event?.entries.find(
    entry => entry.type === EntryType.EXCEPTION
  ) as EntryException | undefined; // could there be more than one? handling only the first one for now
  const exceptionEntryValues = exceptionEntry?.data.values;

  // We would like to filter out all platforms that do not have the concept of source maps
  if (
    !eventFromBrowserJavaScriptSDK &&
    !sourceMaps.includes(eventPlatform as PlatformKey)
  ) {
    return false;
  }

  // If the event already has source maps, we do not want to show this alert
  if (eventHasSourceMaps(event)) {
    return false;
  }

  // If event has no exception, we do not want to show this alert
  if (!exceptionEntry || exceptionEntryValues?.length === 0) {
    return false;
  }

  // If the event does not have exception stacktrace, we do not want to show this alert
  if (
    exceptionEntryValues?.every(
      exception => !exception.stacktrace && !exception.rawStacktrace
    )
  ) {
    return false;
  }

  // If there are no in-app frames, we do not want to show this alert
  if (
    exceptionEntryValues?.every(exception =>
      exception.stacktrace?.frames?.every(frame => !frame.inApp)
    )
  ) {
    return false;
  }

  if (
    exceptionEntryValues?.every(exception =>
      exception.stacktrace?.frames?.every(frame => isFrameFilenamePathlike(frame))
    )
  ) {
    return false;
  }

  // Otherwise, show the alert
  return true;
}

type Props = {
  event: Event;
};

export function SetupSourceMapsAlert({event}: Props) {
  const organization = useOrganization();
  const router = useRouter();
  const projectId = router.location.query.project;
  const eventPlatform = event.platform ?? 'other';
  const eventFromBrowserJavaScriptSDK = isEventFromBrowserJavaScriptSDK(
    event as EventTransaction
  );

  if (!shouldDisplaySetupSourceMapsAlert(organization, projectId, event)) {
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
        <ExternalLink
          href={docUrl}
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
        </ExternalLink>
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
