import styled from '@emotion/styled';
import {Location} from 'history';

import ClippedBox from 'sentry/components/clippedBox';
import Pills from 'sentry/components/pills';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined, generateQueryWithTag} from 'sentry/utils';

import {AnnotatedText} from '../meta/annotatedText';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  projectSlug: string;
};

export function EventTags({event, organization, projectSlug, location}: Props) {
  const meta = event._meta?.tags;

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
        {event.tags.map((tag, index) => (
          <EventTagsPill
            key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
            tag={tag}
            projectSlug={projectSlug}
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
