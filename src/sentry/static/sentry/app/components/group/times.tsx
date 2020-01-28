import {css} from '@emotion/core';
import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import space from 'app/styles/space';
import InlineSvg from 'app/components/inlineSvg';
import TimeSince from 'app/components/timeSince';
import overflowEllipsis from 'app/styles/overflowEllipsis';

/**
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */

type Props = {
  lastSeen: string;
  firstSeen: string;
};

const Times = ({lastSeen, firstSeen}: Props) => {
  return (
    <Container>
      <div
        css={css`
          ${overflowEllipsis}
        `}
      >
        {lastSeen && (
          <React.Fragment>
            <GroupTimeIcon src="icon-clock-sm" />
            <TimeSince date={lastSeen} suffix={t('ago')} />
          </React.Fragment>
        )}
        {firstSeen && lastSeen && (
          <span className="hidden-xs hidden-sm">&nbsp;—&nbsp;</span>
        )}
        {firstSeen && (
          <TimeSince date={firstSeen} suffix={t('old')} className="hidden-xs hidden-sm" />
        )}
      </div>
    </Container>
  );
};
Times.propTypes = {
  lastSeen: PropTypes.string,
  firstSeen: PropTypes.string,
};

const Container = styled('div')`
  flex-shrink: 1;
  min-width: 0; /* flex-hack for overflow-ellipsised children */
`;

const GroupTimeIcon = styled(InlineSvg)`
  /* this is solely for optics, since TimeSince always begins
  with a number, and numbers do not have descenders */
  font-size: ${p => p.theme.fontSizeExtraSmall};
  margin-right: ${space(0.5)};
`;

export default Times;
