import * as Icons from 'sentry/icons';
import {Aliases, Color, IconSize} from 'sentry/utils/theme';

type Props = {
  color: Color | Aliases;
  name: string;
  size: IconSize;
  direction?: 'left' | 'right' | 'up' | 'down';
  isCircled?: boolean;
  isSolid?: boolean;
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
