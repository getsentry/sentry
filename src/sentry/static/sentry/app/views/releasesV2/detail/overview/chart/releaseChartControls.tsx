import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';

import {YAxis} from '.';

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
      case 'sessions':
      default:
        return t('Total Sessions');
    }
  };

  return (
    <ChartControls>
      <InlineContainer>
        <SectionHeading key="total-label">{getSummaryHeading()}</SectionHeading>
        <Value key="total-value">{summary}</Value>
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

const InlineContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const ChartControls = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  padding-right: ${space(1)};
  line-height: 1.2;
`;

const Value = styled('span')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(1)};
`;

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
