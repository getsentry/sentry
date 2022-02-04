import {DeviceName} from 'sentry/components/deviceName';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import Link from 'sentry/components/links/link';
import Version from 'sentry/components/version';
import {Meta} from 'sentry/types';
import {EventTag} from 'sentry/types/event';
import {defined} from 'sentry/utils';

type Props = {
  isRelease: boolean;
  streamPath: string;
  locationSearch: string;
  tag: EventTag;
  meta?: Meta;
};

const EventTagsPillValue = ({
  tag: {key, value},
  meta,
  isRelease,
  streamPath,
  locationSearch,
}: Props) => {
  const getContent = () =>
    isRelease ? (
      <Version version={String(value)} anchor={false} tooltipRawVersion truncate />
    ) : (
      <AnnotatedText
        value={defined(value) && <DeviceName value={String(value)} />}
        meta={meta}
      />
    );

  const content = getContent();

  if (!meta?.err?.length && defined(key)) {
    return <Link to={{pathname: streamPath, search: locationSearch}}>{content}</Link>;
  }

  return content;
};

export default EventTagsPillValue;
