import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import Count from 'app/components/count';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tn} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {CrashFreeTimeBreakdown, GlobalSelection, Organization} from 'app/types';
import {defined} from 'app/utils';

import {displayCrashFreePercent} from '../../utils';

import {getInterval} from './chart/utils';
import {SectionHeading, Wrapper} from './styles';

type Props = AsyncComponent['props'] & {
  location: Location;
  selection: GlobalSelection;
  organization: Organization;
  version: string;
  projectSlug: string;
  defaultStatsPeriod: string;
};

type State = AsyncComponent['state'] & {
  releaseStats?: {usersBreakdown: CrashFreeTimeBreakdown} | null;
};

class TotalCrashFreeUsers extends AsyncComponent<Props, State> {
  shouldReload = true;

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {
      location,
      defaultStatsPeriod,
      organization,
      projectSlug,
      version,
      selection,
    } = this.props;

    return [
      [
        'releaseStats',
        `/projects/${organization.slug}/${projectSlug}/releases/${version}/stats/`,
        {
          query: {
            ...getParams(pick(location.query, [...Object.values(URL_PARAM)]), {
              defaultStatsPeriod,
            }),
            interval: getInterval(selection.datetime),
            type: 'sessions',
          },
        },
      ],
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const crashFreeTimeBreakdown = this.state.releaseStats?.usersBreakdown;

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
  }
}

const Timeline = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.2;
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
  text-align: ${p => (p.right ? 'right' : 'left')};
  color: ${p => (p.bold ? p.theme.textColor : p.theme.gray300)};
  padding-bottom: ${space(0.25)};
  ${overflowEllipsis};
`;

export default TotalCrashFreeUsers;
