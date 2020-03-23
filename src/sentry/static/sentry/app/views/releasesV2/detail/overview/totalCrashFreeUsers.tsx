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

type Props = {
  crashFreeTimeBreakdown: CrashFreeTimeBreakdown;
  startDate?: string;
};

const TotalCrashFreeUsers = ({crashFreeTimeBreakdown, startDate}: Props) => {
  if (!startDate) {
    return null;
  }

  const periodToDays = {
    '1d': 1,
    '1w': 7,
    '2w': 14,
    '4w': 28,
  };

  const periodToLabels = {
    '1d': t('Last day'),
    '1w': t('Last week'),
    '2w': t('Last 2 weeks'),
    '4w': t('Last month'),
  };

  const timeline = Object.entries(crashFreeTimeBreakdown)
    // convert '1d', '1w', etc. to date objects
    .map(([period, value]) => {
      const date = moment().subtract(periodToDays[period], 'days');
      const crashFreeUserCount = Math.round(
        ((value.crashFreeUsers ?? 0) * value.totalUsers) / 100
      );
      return {...value, crashFreeUserCount, period, date};
    })
    // sort them by latest
    .sort((a, b) => (a.date.isAfter(b.date) ? -1 : 1))
    // remove those that are before release was created
    .filter(item => item.date.isAfter(startDate));

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
              <Text>{periodToLabels[row.period]}</Text>
              <Text right>
                {defined(row.crashFreeUsers) ? `${row.crashFreeUsers}%` : '-'}
              </Text>
            </InnerRow>
          </Row>
        ))}
        <Row>
          <InnerRow>
            <Text bold>{moment(startDate).format('MMMM D')}</Text>
          </InnerRow>
          <InnerRow>
            <Text>{t('Release created')}</Text>
          </InnerRow>
        </Row>
      </Timeline>
    </Wrapper>
  );
};

const Timeline = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
  line-height: 1;
`;

const DOT_SIZE = 10;
const Row = styled('div')`
  border-left: 1px solid ${p => p.theme.offWhite2};
  padding-left: ${space(2)};
  padding-bottom: ${space(1)};
  margin-left: ${space(1)};
  position: relative;

  &:before {
    content: '';
    width: ${DOT_SIZE}px;
    height: ${DOT_SIZE}px;
    border-radius: 100%;
    background-color: ${p => p.theme.purple};
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
  padding-bottom: ${space(0.25)};
  ${overflowEllipsis};
`;

export default TotalCrashFreeUsers;
