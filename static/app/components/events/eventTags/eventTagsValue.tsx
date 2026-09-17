import {DeviceName} from 'sentry/components/deviceName';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import type {EventTag} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';

type Props = {
  tag: EventTag;
  meta?: Meta;
  withOnlyFormattedText?: boolean;
};

export function EventTagsValue({
  tag: {value},
  meta,
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

  return content;
}
