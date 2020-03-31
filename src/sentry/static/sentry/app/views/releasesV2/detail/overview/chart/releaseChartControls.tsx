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

export type YAxis = 'sessions' | 'users' | 'crashFree' | 'sessionDuration';

type Props = {
  summary: React.ReactNode;
  yAxis: YAxis;
  onYAxisChange: (value: YAxis) => void;
};

const ReleaseChartControls = ({summary, yAxis, onYAxisChange}: Props) => {
  const yAxisOptions = [
    {
      value: 'sessions',
      label: t('Session Count'),
    },
    {
      value: 'sessionDuration',
      label: t('Session Duration'),
    },
    {
      value: 'users',
      label: t('User Count'),
    },
    {
      value: 'crashFree',
      label: t('Crash Free Rate'),
    },
  ];

  const getSummaryHeading = () => {
    switch (yAxis) {
      case 'users':
        return t('Total Active Users');
      case 'crashFree':
        return t('Average Rate');
      case 'sessionDuration':
        return t('Average Duration');
      case 'sessions':
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
