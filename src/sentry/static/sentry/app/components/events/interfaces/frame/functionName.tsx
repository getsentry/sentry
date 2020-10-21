import {t} from 'app/locale';
import {Frame} from 'app/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';

type Props = {
  frame: Frame;
  hasHiddenDetails?: boolean;
  showCompleteFunctionName?: boolean;
  className?: string;
};

const FunctionName = ({
  frame,
  showCompleteFunctionName,
  hasHiddenDetails,
  className,
}: Props) => {
  const getValueOutput = ():
    | {value: Frame['function']; meta: ReturnType<typeof getMeta>}
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
    <code className={className}>
      {!valueOutput ? (
        t('<unknown>')
      ) : (
        <AnnotatedText value={valueOutput.value} meta={valueOutput.meta} />
      )}
    </code>
  );
};

export default FunctionName;
