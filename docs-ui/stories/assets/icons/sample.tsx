import * as Icons from 'app/icons';
import {Aliases, Color, IconSize} from 'app/utils/theme';

type Props = {
  name: string;
  size: IconSize;
  color: Color | Aliases;
  isCircled?: boolean;
  isSolid?: boolean;
  direction?: 'left' | 'right' | 'up' | 'down';
  type?: 'line' | 'circle' | 'bar';
};

const IconSample = ({name, ...props}: Props) => {
  const Icon = Icons[`Icon${name}`];

  if (!Icon) {
    return null;
  }

  return <Icon {...props} />;
};

export default IconSample;
