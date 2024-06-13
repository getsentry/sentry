import type {Query} from 'history';

import EventTagsContent from 'sentry/components/events/eventTags/eventTagContent';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Pill from 'sentry/components/pill';
import type {EventTag} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';

type Props = {
  organization: Organization;
  projectId: string;
  projectSlug: string;
  query: Query;
  streamPath: string;
  tag: EventTag;
  meta?: Record<any, any>;
};
/**
 * @deprecated Legacy design, use EventTagsTreeRow instead
 */
function EventTagsPill({
  tag,
  query,
  organization,
  projectSlug,
  projectId,
  streamPath,
  meta,
}: Props) {
  const {key, value} = tag;
  const name = !key ? <AnnotatedText value={key} meta={meta?.key?.['']} /> : key;
  const type = !key ? 'error' : undefined;

  return (
    <Pill name={name} value={value} type={type}>
      <EventTagsContent
        tag={tag}
        query={query}
        organization={organization}
        projectSlug={projectSlug}
        projectId={projectId}
        streamPath={streamPath}
        meta={meta}
      />
    </Pill>
  );
}

export default EventTagsPill;
