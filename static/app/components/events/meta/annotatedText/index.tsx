import {AnnotatedTextErrors} from './annotatedTextErrors';
import {AnnotatedTextValue} from './annotatedTextValue';

type Props = {
  value: React.ReactNode;
  className?: string;
  meta?: Record<any, any>;
};

export function AnnotatedText({value, meta, className, ...props}: Props) {
  return (
    <span className={className} {...props}>
      <AnnotatedTextValue value={value} meta={meta} />
      <AnnotatedTextErrors errors={meta?.err} />
    </span>
  );
}
