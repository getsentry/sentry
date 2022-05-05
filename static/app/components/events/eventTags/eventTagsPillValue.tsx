import {DeviceName} from 'sentry/components/deviceName';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import Link from 'sentry/components/links/link';
import {Meta} from 'sentry/types';
import {EventTag} from 'sentry/types/event';
import {defined} from 'sentry/utils';

type Props = {
  locationSearch: string;
  streamPath: string;
  tag: EventTag;
  meta?: Meta;
};

const EventTagsPillValue = ({
  tag: {key, value},
  meta,
  streamPath,
  locationSearch,
}: Props) => {
  const content = (
    <AnnotatedText
      value={defined(value) && <DeviceName value={String(value)} />}
      meta={meta}
    />
  );

  if (!meta?.err?.length && defined(key)) {
    return <Link to={{pathname: streamPath, search: locationSearch}}>{content}</Link>;
  }

  return content;
};

export default EventTagsPillValue;
