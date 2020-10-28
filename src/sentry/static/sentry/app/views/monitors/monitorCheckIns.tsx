import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Monitor} from 'app/views/monitors/types';
import {PanelBody, PanelItem} from 'app/components/panels';
import AsyncComponent from 'app/components/asyncComponent';
import Duration from 'app/components/duration';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';

import CheckInIcon from './checkInIcon';

type CheckIn = {
  dateCreated: string;
  duration: number;
  id: string;
  status: 'ok' | 'error';
};

type Props = {
  monitor: Monitor;
} & AsyncComponent['props'];

type State = {
  checkInList: CheckIn[];
} & AsyncComponent['state'];

export default class MonitorCheckIns extends AsyncComponent<Props, State> {
  static propTypes = {
    monitor: PropTypes.object.isRequired,
  };

  getEndpoints(): [string, string, {query: {per_page: number}}][] {
    const {monitor} = this.props;
    return [
      ['checkInList', `/monitors/${monitor.id}/checkins/`, {query: {per_page: 10}}],
    ];
  }

  renderError() {
    return <ErrorWrapper>{super.renderError()}</ErrorWrapper>;
  }

  renderBody() {
    return (
      <PanelBody>
        {this.state.checkInList.map(checkIn => (
          <PanelItem key={checkIn.id}>
            <CheckInIconWrapper>
              <CheckInIcon status={checkIn.status} size={16} />
            </CheckInIconWrapper>
            <TimeSinceWrapper>
              <TimeSince date={checkIn.dateCreated} />
            </TimeSinceWrapper>
            <div>{checkIn.duration && <Duration seconds={checkIn.duration / 100} />}</div>
          </PanelItem>
        ))}
      </PanelBody>
    );
  }
}

const DivMargin = styled('div')`
  margin-right: ${space(2)};
`;

const CheckInIconWrapper = styled(DivMargin)`
  display: flex;
  align-items: center;
`;

const TimeSinceWrapper = styled(DivMargin)``;

const ErrorWrapper = styled('div')`
  margin: ${space(3)} ${space(3)} 0;
`;
