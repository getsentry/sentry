import type {Meta} from 'sentry/types/group';

import {AnnotatedTextErrors} from './annotatedTextErrors';
import {AnnotatedTextValue} from './annotatedTextValue';

type Props = {
  value: React.ReactNode;
  className?: string;
  meta?: Partial<Meta>;
  withOnlyFormattedText?: boolean;
};

export function AnnotatedText({
  value,
  meta,
  className,
  withOnlyFormattedText = false,
  ...props
}: Props) {
  return (
    <span className={className} {...props}>
      <AnnotatedTextValue value={value} meta={meta} />
      {!withOnlyFormattedText && <AnnotatedTextErrors errors={meta?.err} />}
    </span>
  );
}
