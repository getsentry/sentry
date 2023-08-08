import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {Level} from 'sentry/types';

const DEFAULT_SIZE = '13px';

type Props = {
  className?: string;
  level?: Level;
  size?: string;
};

function ErrorLevel({className, level = 'unknown', size = '11px'}: Props) {
  const levelLabel = tct('Level: [level]', {level: capitalize(level)});

  return (
    <Tooltip skipWrapper disabled={level === 'unknown'} title={levelLabel}>
      <ColoredCircle className={className} level={level} size={size}>
        {levelLabel}
      </ColoredCircle>
    </Tooltip>
  );
}

const ColoredCircle = styled('span')<Props>`
  padding: 0;
  position: relative;
  width: ${p => p.size || DEFAULT_SIZE};
  height: ${p => p.size || DEFAULT_SIZE};
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => (p.level ? p.theme.level[p.level] : p.theme.level.error)};
`;

export default ErrorLevel;
