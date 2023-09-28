import {useEffect} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import ClippedBox from 'sentry/components/clippedBox';
import Pills from 'sentry/components/pills';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined, generateQueryWithTag} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isMobilePlatform} from 'sentry/utils/platform';

import {AnnotatedText} from '../meta/annotatedText';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  projectSlug: string;
};

const IOS_DEVICE_FAMILIES = ['iPhone', 'iOS', 'iOS-Device'];

export function EventTags({event, organization, projectSlug, location}: Props) {
  const meta = event._meta?.tags;
  const projectId = event.projectID;

  const tags = !organization.features.includes('device-classification')
    ? event.tags?.filter(tag => tag.key !== 'device.class')
    : event.tags;

  useEffect(() => {
    if (
      organization.features.includes('device-classification') &&
      isMobilePlatform(event.platform)
    ) {
      const deviceClass = event.tags.find(tag => tag.key === 'device.class')?.value;
      const deviceFamily = event.tags.find(tag => tag.key === 'device.family')?.value;
      const deviceModel = event.tags.find(tag => tag.key === 'device.model')?.value;
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
          event.tags.find(tag => tag.key === 'device.processor_count')?.value ?? '',
          10
        );
        const deviceProcessorFrequency = parseInt(
          event.tags.find(tag => tag.key === 'device.processor_frequency')?.value ?? '',
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
  }, [event, organization]);

  useEffect(() => {
    const mechanism = event.tags?.find(tag => tag.key === 'mechanism')?.value;
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
    if (mechanism && transaction) {
      transaction.tags.hasMechanism = mechanism;
    }
  }, [event]);

  if (!!meta?.[''] && !event.tags) {
    return <AnnotatedText value={event.tags} meta={meta?.['']} />;
  }

  if (!(event.tags ?? []).length) {
    return null;
  }

  const orgSlug = organization.slug;
  const streamPath = `/organizations/${orgSlug}/issues/`;

  return (
    <StyledClippedBox clipHeight={150}>
      <Pills>
        {tags.map((tag, index) => (
          <EventTagsPill
            key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
            tag={tag}
            projectSlug={projectSlug}
            projectId={projectId}
            organization={organization}
            query={generateQueryWithTag({...location.query, referrer: 'event-tags'}, tag)}
            streamPath={streamPath}
            meta={meta?.[index]}
          />
        ))}
      </Pills>
    </StyledClippedBox>
  );
}

const StyledClippedBox = styled(ClippedBox)`
  padding: 0;
`;
