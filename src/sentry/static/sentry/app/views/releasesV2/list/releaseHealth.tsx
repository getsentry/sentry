import React from 'react';
import styled from '@emotion/styled';

import {Release} from 'app/types';
import {PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {t} from 'app/locale';
import space from 'app/styles/space';
import CircleProgress from 'app/components/circularProgressbar';
import Count from 'app/components/count';

import UsersChart from './usersChart';
import {mockData} from './mock';

type Props = {
  release: Release;
};

const ReleaseHealth = ({release}: Props) => {
  return (
    <React.Fragment>
      <StyledPanelHeader>
        <Layout>
          <div>{t('Mobile Project')}</div>
          <div>{t('Crash free users')}</div>
          <div>{t('Crash free sessions')}</div>
          <div>{t('Daily active users')}</div>
          <RightColumn>{t('Mobile crashes')}</RightColumn>
          <RightColumn>{t('Mobile errors')}</RightColumn>
        </Layout>
      </StyledPanelHeader>

      <PanelBody>
        {release.projects.map((project, index) => (
          <PanelItem key={project.slug}>
            <Layout>
              <div>
                <ProjectBadge project={project} avatarSize={14} />
              </div>
              {/* TODO(releasesv2): make dynamic once api is finished */}
              <div>
                <CircleProgress value={mockData[index].crashFreeUsersPercent} />
                <CircleProgressCaption>
                  {mockData[index].crashFreeUsersPercent}%
                </CircleProgressCaption>
              </div>
              <div>
                <CircleProgress value={mockData[index].crashFreeUsersSessionsPercent} />
                <CircleProgressCaption>
                  {mockData[index].crashFreeUsersSessionsPercent}%
                </CircleProgressCaption>
              </div>
              <ChartColumn>
                <ChartWrapper>
                  <UsersChart data={mockData[index].graphData} statsPeriod="24h" />
                </ChartWrapper>
                {mockData[index].dailyActiveUsers}%
              </ChartColumn>
              <RightColumn>
                <ColoredCount value={mockData[index].crashes} />
              </RightColumn>
              <RightColumn>
                <ColoredCount value={mockData[index].errors} />
              </RightColumn>
            </Layout>
          </PanelItem>
        ))}
      </PanelBody>
    </React.Fragment>
  );
};

const StyledPanelHeader = styled(PanelHeader)`
  border-top: 1px solid ${p => p.theme.borderDark};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 200px 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const RightColumn = styled('div')`
  text-align: right;
`;

const CircleProgressCaption = styled('span')`
  margin-left: ${space(1)};
`;

const ChartColumn = styled('div')`
  display: flex;
`;

const ChartWrapper = styled('div')`
  width: 150px;
  margin-right: ${space(2)};
  position: relative;
  bottom: 4px;
`;

const ColoredCount = styled(Count)`
  /* TODO(releasesv2): decide on threshold, make dynamic */
  ${p => p.value > 7000 && `color: ${p.theme.red};`}
`;

export default ReleaseHealth;
