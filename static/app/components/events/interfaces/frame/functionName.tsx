import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {t} from 'sentry/locale';
import {Frame} from 'sentry/types';

type Props = {
  frame: Frame;
  className?: string;
  hasHiddenDetails?: boolean;
  showCompleteFunctionName?: boolean;
};

const FunctionName = ({
  frame,
  showCompleteFunctionName,
  hasHiddenDetails,
  className,
  ...props
}: Props) => {
  const getValueOutput = ():
    | {meta: ReturnType<typeof getMeta>; value: Frame['function']}
    | undefined => {
    if (hasHiddenDetails && showCompleteFunctionName && frame.rawFunction) {
      return {
        value: frame.rawFunction,
        meta: getMeta(frame, 'rawFunction'),
      };
    }

    if (frame.function) {
      return {
        value: frame.function,
        meta: getMeta(frame, 'function'),
      };
    }

    if (frame.rawFunction) {
      return {
        value: frame.rawFunction,
        meta: getMeta(frame, 'rawFunction'),
      };
    }

    return undefined;
  };

  const valueOutput = getValueOutput();

  return (
    <code className={className} {...props}>
      {!valueOutput ? (
        t('<unknown>')
      ) : (
        <AnnotatedText value={valueOutput.value} meta={valueOutput.meta} />
      )}
    </code>
  );
};

export default FunctionName;
