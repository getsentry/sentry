import {Fragment} from 'react';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';

interface Props {
  meta: Record<any, any> | undefined;
  withAnnotatedText: boolean;
  value?: React.ReactNode;
  withOnlyFormattedText?: boolean;
}

export default function AnnotatedValue({
  value,
  withAnnotatedText,
  withOnlyFormattedText = false,
  meta,
}: Props) {
  if (!withAnnotatedText || !meta) {
    return <Fragment>{value}</Fragment>;
  }

  return (
    <AnnotatedText
      value={value}
      meta={meta?.[''] ?? meta}
      withOnlyFormattedText={withOnlyFormattedText}
    />
  );
}
