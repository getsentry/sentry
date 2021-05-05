import {formatBytesBase2} from 'app/utils';
import getDynamicText from 'app/utils/getDynamicText';

type Props = {
  className?: string;
  bytes: number;
};

function FileSize(props: Props) {
  const {className, bytes} = props;

  return (
    <span className={className}>
      {getDynamicText({value: formatBytesBase2(bytes), fixed: 'xx KB'})}
    </span>
  );
}

export default FileSize;
