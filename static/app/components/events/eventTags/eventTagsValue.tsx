import {DeviceName} from 'sentry/components/deviceName';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import Link from 'sentry/components/links/link';
import type {EventTag} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import {defined} from 'sentry/utils';

type Props = {
  tag: EventTag;
  locationSearch?: string;
  meta?: Meta;
  streamPath?: string;
  withOnlyFormattedText?: boolean;
};

function EventTagsValue({
  tag: {key, value},
  meta,
  streamPath,
  locationSearch,
  withOnlyFormattedText = false,
}: Props) {
  const content = meta ? (
    <AnnotatedText
      value={value}
      meta={meta}
      withOnlyFormattedText={withOnlyFormattedText}
    />
  ) : (
    <DeviceName value={String(value)} />
  );

  if (!meta?.err?.length && defined(key) && streamPath && locationSearch) {
    return <Link to={{pathname: streamPath, search: locationSearch}}>{content}</Link>;
  }

  return content;
}

export default EventTagsValue;
