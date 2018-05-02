import React from 'react';
import styled from 'react-emotion';
import moment from 'moment';

import {tct} from 'app/locale';
import SentryTypes from 'app/proptypes';

const BACKFILL_DATE = '2018-05-01';

export default class BackfillNotice extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
  };

  render() {
    const shouldDisplayWarning = moment(BACKFILL_DATE).isAfter(
      moment(this.props.project.dateCreated)
    );

    return (
      shouldDisplayWarning && (
        <StyledCallout>
          {tct(
            `You can now filter by environment.
          Data before [backfillDate] may be temporarily unavailable.`,
            {
              backfillDate: moment(BACKFILL_DATE).format('MMM d'),
            }
          )}
        </StyledCallout>
      )
    );
  }
}

const StyledCallout = styled.div`
  font-size: 11px;
  width: 190px;
  color: white;
  background-color: ${p => p.theme.blueDark};
  border-radius: 8px;
  padding: 6px;
  height: 44px;
  margin-top: 4px;
  margin-right: 20px;
  position: relative;
  &:before {
    content: '';
    border-style: solid;
    border-width: 6px 0 6px 6px;
    border-color: transparent transparent transparent ${p => p.theme.blueDark};
    position: absolute;
    right: -6px;
    top: 14px;
  }
`;
