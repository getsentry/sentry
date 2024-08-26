import {Fragment} from 'react';
import styled from '@emotion/styled';

import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import type {Level} from 'sentry/types/event';
import {capitalize} from 'sentry/utils/string/capitalize';
import {Divider} from 'sentry/views/issueDetails/divider';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

const DEFAULT_SIZE = '13px';

type Props = {
  className?: string;
  level?: Level;
  showUnhandled?: boolean;
  size?: string;
};

function ErrorLevel({className, showUnhandled, level = 'unknown', size = '11px'}: Props) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const levelLabel = tct('Level: [level]', {level: capitalize(level)});

  if (hasStreamlinedUI) {
    return (
      <Fragment>
        {showUnhandled ? (
          <Fragment>
            <UnhandledTag />
            <Divider />
          </Fragment>
        ) : null}
        {capitalize(level)}
        <Divider />
      </Fragment>
    );
  }

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
