import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';

export enum YAxis {
  SESSIONS = 'sessions',
  USERS = 'users',
  CRASH_FREE = 'crashFree',
  SESSION_DURATION = 'sessionDuration',
}

type Props = {
  summary: React.ReactNode;
  yAxis: YAxis;
  onYAxisChange: (value: YAxis) => void;
};

const ReleaseChartControls = ({summary, yAxis, onYAxisChange}: Props) => {
  const yAxisOptions = [
    {
      value: YAxis.SESSIONS,
      label: t('Session Count'),
    },
    {
      value: YAxis.SESSION_DURATION,
      label: t('Session Duration'),
    },
    {
      value: YAxis.USERS,
      label: t('User Count'),
    },
    {
      value: YAxis.CRASH_FREE,
      label: t('Crash Free Rate'),
    },
  ];

  const getSummaryHeading = () => {
    switch (yAxis) {
      case YAxis.USERS:
        return t('Total Active Users');
      case YAxis.CRASH_FREE:
        return t('Average Rate');
      case YAxis.SESSION_DURATION:
        return t('Average Duration');
      case YAxis.SESSIONS:
      default:
        return t('Total Sessions');
    }
  };

  return (
    <ChartControls>
      <InlineContainer>
        <SectionHeading key="total-label">{getSummaryHeading()}</SectionHeading>
        <SectionValue key="total-value">{summary}</SectionValue>
      </InlineContainer>

      {/* TODO(releasesV2): this will be down the road replaced with discover's YAxisSelector */}
      <InlineContainer>
        <SectionHeading>{t('Y-Axis')}</SectionHeading>
        <DropdownControl
          alignRight
          menuWidth="150px"
          button={({getActorProps}) => (
            <StyledDropdownButton {...getActorProps()} size="zero" isOpen={false}>
              {yAxisOptions.find(option => option.value === yAxis)?.label}
            </StyledDropdownButton>
          )}
        >
          {yAxisOptions.map(option => (
            <DropdownItem
              key={option.value}
              onSelect={onYAxisChange}
              eventKey={option.value}
              isActive={option.value === yAxis}
            >
              {option.label}
            </DropdownItem>
          ))}
        </DropdownControl>
      </InlineContainer>
    </ChartControls>
  );
};

const StyledDropdownButton = styled(DropdownButton)`
  padding: ${space(1)} ${space(2)};
  font-weight: normal;
  color: ${p => p.theme.gray3};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.gray4};
  }
`;

export default ReleaseChartControls;
