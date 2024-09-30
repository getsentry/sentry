import {Fragment, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import EventTagCustomBanner from 'sentry/components/events/eventTags/eventTagCustomBanner';
import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import {TagFilter} from 'sentry/components/events/eventTags/util';
import type {Event, EventTag} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isMobilePlatform} from 'sentry/utils/platform';
import useOrganization from 'sentry/utils/useOrganization';

import {AnnotatedText} from '../meta/annotatedText';

type Props = {
  event: Event;
  projectSlug: Project['slug'];
  filteredTags?: EventTag[];
  tagFilter?: TagFilter;
};

const IOS_DEVICE_FAMILIES = ['iPhone', 'iOS', 'iOS-Device'];

export function EventTags({
  event,
  filteredTags,
  projectSlug,
  tagFilter = TagFilter.ALL,
}: Props) {
  const organization = useOrganization();
  const meta = event._meta?.tags;

  const tagsSource = defined(filteredTags) ? filteredTags : event.tags;

  const tags = tagsSource;

  useEffect(() => {
    if (isMobilePlatform(event.platform)) {
      const deviceClass = tagsSource.find(tag => tag.key === 'device.class')?.value;
      const deviceFamily = tagsSource.find(tag => tag.key === 'device.family')?.value;
      const deviceModel = tagsSource.find(tag => tag.key === 'device.model')?.value;
      if (deviceFamily && IOS_DEVICE_FAMILIES.includes(deviceFamily)) {
        // iOS device missing classification, this probably indicates a new iOS device which we
        // haven't yet classified.
        if (!deviceClass && deviceModel) {
          trackAnalytics('device.classification.unclassified.ios.device', {
            organization,
            model: deviceModel,
          });
        }
      } else {
        const deviceProcessorCount = parseInt(
          tagsSource.find(tag => tag.key === 'device.processor_count')?.value ?? '',
          10
        );
        const deviceProcessorFrequency = parseInt(
          tagsSource.find(tag => tag.key === 'device.processor_frequency')?.value ?? '',
          10
        );
        // Android device specs significantly higher than current high end devices.
        // Consider bumping up internal device.class values if this gets triggered a lot.
        if (
          deviceProcessorFrequency > 3499 ||
          (deviceProcessorCount > 9 && deviceProcessorFrequency > 3299)
        ) {
          trackAnalytics('device.classification.high.end.android.device', {
            organization,
            class: deviceClass,
            family: deviceFamily,
            model: deviceModel,
            processor_count: deviceProcessorCount,
            processor_frequency: deviceProcessorFrequency,
          });
        }
      }
    }
  }, [event, tagsSource, organization]);

  useEffect(() => {
    const mechanism = filteredTags?.find(tag => tag.key === 'mechanism')?.value;
    const span = Sentry.getActiveSpan();
    if (mechanism && span) {
      Sentry.getRootSpan(span).setAttribute('hasMechanism', mechanism);
    }
  }, [filteredTags]);

  if (!!meta?.[''] && !filteredTags) {
    return <AnnotatedText value={filteredTags} meta={meta?.['']} />;
  }

  if (!(event.tags ?? []).length) {
    return null;
  }

  const hasCustomTagsBanner = tagFilter === TagFilter.CUSTOM && tags.length === 0;

  // filter out replayId since we no longer want to display this on
  // trace or issue details
  const filtered = tags.filter(t => t.key !== 'replayId');

  return (
    <Fragment>
      <EventTagsTree
        event={event}
        meta={meta}
        projectSlug={projectSlug}
        tags={filtered}
      />
      {hasCustomTagsBanner && <EventTagCustomBanner />}
    </Fragment>
  );
}
