import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import MetaData from 'sentry/components/events/meta/metaData';
import {isFunction} from 'sentry/utils';

type Props<Values> = {
  children: (value: string | null | React.ReactNode) => React.ReactNode | string;
  object: Values;
  objectKey: Extract<keyof Values, string>;
  required?: boolean;
};

/**
 * Returns the value of `object[prop]` and returns an annotated component if
 * there is meta data
 */
const Annotated = <Values extends {}>({
  children,
  object,
  objectKey,
  required = false,
}: Props<Values>) => {
  return (
    <MetaData object={object} prop={objectKey} required={required}>
      {(value, meta) => {
        const toBeReturned = <AnnotatedText value={value} meta={meta} />;
        return isFunction(children) ? children(toBeReturned) : toBeReturned;
      }}
    </MetaData>
  );
};

export default Annotated;
