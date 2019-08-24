import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import TimeSince from 'app/components/timeSince';
import overflowEllipsis from 'app/styles/overflowEllipsis';

/**
 * Renders the first & last seen times for a group or event with
 * a clock icon.
 */
const Times = props => {
  const {lastSeen, firstSeen} = props;
  return (
    <Container>
      <div css={overflowEllipsis}>
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
  font-size: 11px;
  margin-right: 4px;
`;

export default Times;
