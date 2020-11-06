import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {CrashFreeTimeBreakdown} from 'app/types';
import {defined} from 'app/utils';
import Count from 'app/components/count';

import {SectionHeading, Wrapper} from './styles';
import {displayCrashFreePercent} from '../../utils';

type Props = {
  crashFreeTimeBreakdown: CrashFreeTimeBreakdown;
};

const TotalCrashFreeUsers = ({crashFreeTimeBreakdown}: Props) => {
  if (!crashFreeTimeBreakdown?.length) {
    return null;
  }

  const timeline = crashFreeTimeBreakdown
    .map(({date, crashFreeUsers, totalUsers}, index, data) => {
      // count number of crash free users from knowing percent and total
      const crashFreeUserCount = Math.round(((crashFreeUsers ?? 0) * totalUsers) / 100);
      // first item of timeline is release creation date, then we want to have relative date label
      const dateLabel =
        index === 0
          ? t('Release created')
          : `${moment(data[0].date).from(date, true)} ${t('later')}`;

      return {date: moment(date), dateLabel, crashFreeUsers, crashFreeUserCount};
    })
    // remove those timeframes that are in the future
    .filter(item => item.date.isBefore())
    // we want timeline to go from bottom to up
    .reverse();

  if (!timeline.length) {
    return null;
  }

  return (
    <Wrapper>
      <SectionHeading>{t('Total Crash Free Users')}</SectionHeading>
      <Timeline>
        {timeline.map(row => (
          <Row key={row.date.toString()}>
            <InnerRow>
              <Text bold>{row.date.format('MMMM D')}</Text>
              <Text bold right>
                <Count value={row.crashFreeUserCount} />{' '}
                {tn('user', 'users', row.crashFreeUserCount)}
              </Text>
            </InnerRow>
            <InnerRow>
              <Text>{row.dateLabel}</Text>
              <Text right>
                {defined(row.crashFreeUsers)
                  ? displayCrashFreePercent(row.crashFreeUsers)
                  : '-'}
              </Text>
            </InnerRow>
          </Row>
        ))}
      </Timeline>
    </Wrapper>
  );
};

const Timeline = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray600};
  line-height: 1;
`;

const DOT_SIZE = 10;
const Row = styled('div')`
  border-left: 1px solid ${p => p.theme.border};
  padding-left: ${space(2)};
  padding-bottom: ${space(1)};
  margin-left: ${space(1)};
  position: relative;

  &:before {
    content: '';
    width: ${DOT_SIZE}px;
    height: ${DOT_SIZE}px;
    border-radius: 100%;
    background-color: ${p => p.theme.purple300};
    position: absolute;
    top: 0;
    left: -${Math.floor(DOT_SIZE / 2)}px;
  }

  &:last-child {
    border-left: 0;
  }
`;
const InnerRow = styled('div')`
  display: grid;
  grid-column-gap: ${space(2)};
  grid-auto-flow: column;
  grid-auto-columns: 1fr;

  padding-bottom: ${space(0.5)};
`;

const Text = styled('div')<{bold?: boolean; right?: boolean}>`
  font-weight: ${p => (p.bold ? 600 : 400)};
  text-align: ${p => (p.right ? 'right' : 'left')};
  color: ${p => (p.bold ? p.theme.gray600 : p.theme.gray500)};
  padding-bottom: ${space(0.25)};
  ${overflowEllipsis};
`;

export default TotalCrashFreeUsers;
