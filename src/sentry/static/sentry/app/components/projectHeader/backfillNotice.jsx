import React from 'react';
import styled from 'react-emotion';
import moment from 'moment';
import Cookies from 'js-cookie';

import {tct} from 'app/locale';
import SentryTypes from 'app/proptypes';
import space from '../../styles/space';
import InlineSvg from '../inlineSvg';
import {slideInRight} from '../../styles/animations';

const BACKFILL_DATE = '2018-05-11';

export default class BackfillNotice extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
  };

  constructor(...args) {
    super(...args);

    this.state = {
      isDismissed: false,
    };
  }

  onClose = () => {
    Cookies.set('backfill_notification_closed', 'true');
    this.setState({isDismissed: true});
  };

  render() {
    const shouldDisplayWarning =
      moment(BACKFILL_DATE).isAfter(moment(this.props.project.dateCreated)) &&
      Cookies.get('backfill_notification_closed') !== 'true' &&
      this.state.isDismissed == false;

    return shouldDisplayWarning ? (
      <StyledCallout>
        <InfoIcon src="icon-circle-info" />
        {tct(
          `You can now filter by environment!
          Environment-specific data may not be available for issues created before [backfillDate].`,
          {
            backfillDate: moment(BACKFILL_DATE).format('MMM D'),
          }
        )}
        <CloseButton src="icon-close-lg" onClick={this.onClose} />
      </StyledCallout>
    ) : null;
  }
}

const StyledCallout = styled.div`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  background-color: ${p => p.theme.offWhite2};
  border-radius: ${p => p.theme.borderRadius};
  animation: 0.5s ${slideInRight};
  width: 400px;
  padding: ${space(1)};
  position: absolute;
  right: calc(100% + ${space(2)});
  top: ${space(2)};
  display: flex;
  align-items: center;
  z-index: ${p => p.theme.zIndex.dropdown};
  &:before {
    content: '';
    border-style: solid;
    border-width: ${space(1)} 0 ${space(1)} ${space(1)};
    border-color: transparent transparent transparent ${p => p.theme.offWhite2};
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
  }
`;

const InfoIcon = styled(InlineSvg)`
  fill: ${p => p.theme.textColor};
  width: 20px;
  height: 20px;
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const CloseButton = styled(InlineSvg)`
  stroke: ${p => p.theme.gray4};
  width: 16px;
  height: 16px;
  margin: 0 ${space(0.5)} 0 ${space(1)};
  cursor: pointer;
`;
