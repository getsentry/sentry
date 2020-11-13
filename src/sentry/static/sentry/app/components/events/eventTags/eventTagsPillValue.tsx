import React from 'react';

import {Meta, EventTag} from 'app/types';
import Version from 'app/components/version';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import DeviceName from 'app/components/deviceName';
import Link from 'app/components/links/link';
import {defined} from 'app/utils';

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
