import {AnnotatedTextErrors} from './annotatedTextErrors';
import {AnnotatedTextValue} from './annotatedTextValue';

type Props = {
  value: React.ReactNode;
  className?: string;
  meta?: Record<any, any>;
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
