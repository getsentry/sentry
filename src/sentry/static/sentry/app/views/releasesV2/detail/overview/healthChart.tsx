import React from 'react';
import styled from '@emotion/styled';
import {withRouter} from 'react-router';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {EventsChart} from 'app/views/events/eventsChart';
import withOrganization from 'app/utils/withOrganization';
import {Client} from 'app/api';

// VERY ROUGH MOCK, MORE LIKE VISUAL PLACEHOLDER, this will be changed completely

const HealthChart = ({organization, router}: any) => (
  <Panel>
    <ChartWrapper>
      <EventsChart
        {...{
          api: new Client(),
          router,
          query: '',
          organization,
          showLegend: true,
          yAxis: 'count(id)',
          projects: [],
          environments: [],
          period: '24h',
          utc: false,
        }}
      />
    </ChartWrapper>

    <ChartControls>
      <InlineContainer>
        <SectionHeading key="total-label">{t('Total Active Users')}</SectionHeading>
        <Value key="total-value">{(1234).toLocaleString()}</Value>
      </InlineContainer>

      <InlineContainer>
        <SectionHeading>{t('Y-Axis')}</SectionHeading>
        <DropdownControl
          menuWidth="auto"
          alignRight
          button={({getActorProps}) => (
            <StyledDropdownButton {...getActorProps()} size="zero" isOpen={false}>
              Active User Count
            </StyledDropdownButton>
          )}
        >
          {[{value: 'activeUserCount', label: t('Active User Count')}].map(
            (opt, index) => (
              <DropdownItem
                key={opt.value}
                onSelect={() => {}}
                eventKey={opt.value}
                isActive={index === 1}
              >
                {opt.label}
              </DropdownItem>
            )
          )}
        </DropdownControl>
      </InlineContainer>
    </ChartControls>
  </Panel>
);

const InlineContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const ChartWrapper = styled('div')`
  padding: ${space(1)} ${space(3)};
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

export default withOrganization(withRouter(HealthChart));
