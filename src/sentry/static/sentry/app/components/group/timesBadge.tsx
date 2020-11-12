import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {IconClock} from 'app/icons';
import space from 'app/styles/space';
import TimeSince from 'app/components/timeSince';

/**
 * Used in new inbox
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
      <Wrapper>
        {lastSeen && (
          <React.Fragment>
            <StyledIconClock size="11px" color="purple300" />
            <TimeSince date={lastSeen} suffix={t('ago')} shorten />
          </React.Fragment>
        )}
        {firstSeen && lastSeen && (
          <Seperator className="hidden-xs hidden-sm">&nbsp;|&nbsp;</Seperator>
        )}
        {firstSeen && (
          <TimeSince
            date={firstSeen}
            suffix={t('old')}
            className="hidden-xs hidden-sm"
            shorten
          />
        )}
      </Wrapper>
    </Container>
  );
};
Times.propTypes = {
  lastSeen: PropTypes.string,
  firstSeen: PropTypes.string,
};

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(0.25)} ${space(0.75)};

  background-color: ${p => p.theme.gray100};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-align: center;
  border-radius: 17px;
`;

const StyledIconClock = styled(IconClock)`
  margin-right: ${space(0.5)};
`;

const Seperator = styled('span')`
  color: ${p => p.theme.subText};
`;

export default Times;
