import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import ClippedBox from 'sentry/components/clippedBox';
import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import {TagFilter, useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import Pills from 'sentry/components/pills';
import type {Event, EventTag} from 'sentry/types/event';
import {defined, generateQueryWithTag} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isMobilePlatform} from 'sentry/utils/platform';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {AnnotatedText} from '../meta/annotatedText';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  projectSlug: string;
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
  const location = useLocation();
  const organization = useOrganization();
  const hasNewTagsUI = useHasNewTagsUI();
  const meta = event._meta?.tags;
  const projectId = event.projectID;

  const tagsSource = defined(filteredTags) ? filteredTags : event.tags;

  const tags = !organization.features.includes('device-classification')
    ? tagsSource?.filter(tag => tag.key !== 'device.class')
    : tagsSource;

  useEffect(() => {
    if (
      organization.features.includes('device-classification') &&
      isMobilePlatform(event.platform)
    ) {
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
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (mechanism && transaction) {
      transaction.tags.hasMechanism = mechanism;
    }
  }, [filteredTags]);

  if (!!meta?.[''] && !filteredTags) {
    return <AnnotatedText value={filteredTags} meta={meta?.['']} />;
  }

  if (!(filteredTags ?? []).length) {
    return null;
  }

  return (
    <StyledClippedBox clipHeight={150}>
      {hasNewTagsUI ? (
        <EventTagsTree
          event={event}
          tags={tags}
          meta={meta}
          projectSlug={projectSlug}
          tagFilter={tagFilter}
        />
      ) : (
        <Pills>
          {tags.map((tag, index) => (
            <EventTagsPill
              key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
              tag={tag}
              projectSlug={projectSlug}
              projectId={projectId}
              organization={organization}
              query={generateQueryWithTag(
                {...location.query, referrer: 'event-tags'},
                tag
              )}
              streamPath={`/organizations/${organization.slug}/issues/`}
              meta={meta?.[index]}
            />
          ))}
        </Pills>
      )}
    </StyledClippedBox>
  );
}

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;
