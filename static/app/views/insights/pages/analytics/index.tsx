import {Fragment} from 'react';
import styled from '@emotion/styled';
import iconChrome from 'sentry-logos/logo-chrome.svg';
import iconDiscord from 'sentry-logos/logo-discord.svg';
import iconEdge from 'sentry-logos/logo-edge-new.svg';
import iconFirefox from 'sentry-logos/logo-firefox.svg';
import iconGithub from 'sentry-logos/logo-github.svg';
import iconGitlab from 'sentry-logos/logo-gitlab.svg';
import iconGoogle from 'sentry-logos/logo-google.svg';
import iconJira from 'sentry-logos/logo-jira.svg';
import iconOpera from 'sentry-logos/logo-opera.svg';
import iconSafari from 'sentry-logos/logo-safari.svg';

import {Button} from 'sentry/components/button';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import IntervalSelector from 'sentry/components/charts/intervalSelector';
import {LineChart, type LineChartSeries} from 'sentry/components/charts/lineChart';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import DropdownButton from 'sentry/components/dropdownButton';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconExpand, IconLink, IconMobile} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {formatPercent} from 'sentry/views/settings/dynamicSampling/utils/formatPercent';

const BUCKET_SIZE =
  new Date('2024-01-02T00:00:00Z').getTime() - new Date('2024-01-01T00:00:00Z').getTime();

function formatAxisLabel(value: number) {
  return String(defaultFormatAxisLabel(value, true, true, true, false, BUCKET_SIZE));
}

function Analytics() {
  const location = useLocation();
  const eventView = EventView.fromLocation(location);
  eventView.interval = '1d';
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>Analytics</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <FilterContainer>
            <PageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter />
            </PageFilterBar>
          </FilterContainer>
          <Panel>
            <StyledTabList>
              <TabItem data-active>
                <TabTitle>Unique Visitors</TabTitle>
                <TabDetails>
                  <TabTotal>
                    <Count value={visits.reduce((acc, visit) => acc + visit.value, 0)} />
                  </TabTotal>
                  <TabTrend data-trend="positive">+15%</TabTrend>
                </TabDetails>
                <InteractionStateLayer />
              </TabItem>
              <TabItem>
                <TabTitle>Total Visits</TabTitle>
                <TabDetails>
                  <TabTotal>
                    <Count
                      value={visits.reduce((acc, visit) => acc + visit.value, 0) * 6}
                    />
                  </TabTotal>
                  <TabTrend data-trend="negative">-6%</TabTrend>
                </TabDetails>
                <InteractionStateLayer />
              </TabItem>
            </StyledTabList>
            <MainChart
              series={[
                {
                  seriesName: 'Unique Visitors',
                  data: visits,
                },
              ]}
            />
            <ChartControls>
              <InlineContainer>
                <SectionHeading>Total</SectionHeading>
                <SectionValue>
                  {visits.reduce((acc, visit) => acc + visit.value, 0)}
                </SectionValue>
              </InlineContainer>
              <InlineContainer>
                <IntervalSelector
                  displayMode={'default'}
                  eventView={eventView}
                  onIntervalChange={() => {}}
                />
              </InlineContainer>
            </ChartControls>
          </Panel>
          <Grid>
            <PlaceholderPanel>
              <PanelHeader hasButtons>
                <DropdownButton borderless size="zero">
                  Top Sources
                </DropdownButton>
              </PanelHeader>
              <PanelBody withPadding>
                <TagList tags={sources} />
                <ViewMoreContainer>
                  <Button priority="link" icon={<IconExpand />}>
                    View More
                  </Button>
                </ViewMoreContainer>
              </PanelBody>
            </PlaceholderPanel>
            <PlaceholderPanel>
              <PanelHeader hasButtons>
                <DropdownButton borderless size="zero">
                  Top Pages
                </DropdownButton>
              </PanelHeader>
              <PanelBody withPadding>
                <TagList tags={pagesTags} />
              </PanelBody>
            </PlaceholderPanel>
            <PlaceholderPanel>
              <PanelHeader hasButtons>
                <DropdownButton borderless size="zero">
                  Browser
                </DropdownButton>
              </PanelHeader>
              <PanelBody withPadding>
                <TagList tags={browsers} />
                <ViewMoreContainer>
                  <Button priority="link" icon={<IconExpand />}>
                    View More
                  </Button>
                </ViewMoreContainer>
              </PanelBody>
            </PlaceholderPanel>
          </Grid>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

interface Tag {
  name: string;
  value: number;
  icon?: React.ReactNode;
}

function TagList({tags}: {tags: Tag[]}) {
  const total = tags.reduce((acc, tag) => acc + tag.value, 0);
  return (
    <UnstyledUnorderedList>
      {tags.map((tag, index) => (
        <li key={index} data-test-id={tag.name}>
          <TagBarGlobalSelectionLink>
            <TagBarBackground
              widthPercent={formatPercent(tag.value / total, {addSymbol: true})}
            />
            <TagBarLabel>
              {tag.icon}
              {tag.icon ? <Fragment>&nbsp;&nbsp;</Fragment> : null}
              {tag.name}
            </TagBarLabel>
            <TagBarCount>
              <Count value={tag.value} />
            </TagBarCount>
          </TagBarGlobalSelectionLink>
        </li>
      ))}
    </UnstyledUnorderedList>
  );
}

function MainChart({series}: {series: LineChartSeries[]}) {
  return (
    <Fragment>
      <LineChart
        width={'auto'}
        height={300}
        xAxis={{
          type: 'time',
          axisLabel: {
            show: true,
            formatter: formatAxisLabel,
          },
        }}
        tooltip={{
          formatAxisLabel,
        }}
        series={series}
      />
    </Fragment>
  );
}

export default Analytics;

const PlaceholderPanel = styled(Panel)`
  margin-bottom: 0px;
`;

const StyledTabList = styled('div')`
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 6px 6px 0 0;
`;

const TabItem = styled('div')`
  padding: ${space(2)} ${space(2)} ${space(1)} ${space(2)};
  margin-bottom: -1px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  position: relative;

  &[data-active='true'] {
    border-bottom-color: ${p => p.theme.purple400};
  }
`;

const TabTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  font-weight: 600;

  ${TabItem}[data-active='true'] > & {
    color: ${p => p.theme.purple400};
  }
`;

const TabDetails = styled('div')`
  display: flex;
  gap: ${space(1.5)};
  align-items: start;
  padding-top: ${space(0.5)};
`;

const TabTotal = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const TabTrend = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};

  &[data-trend='positive'] {
    color: ${p => p.theme.green300};
  }

  &[data-trend='negative'] {
    color: ${p => p.theme.red300};
  }
`;

const Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(300px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const FilterContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  justify-content: flex-start;
`;

/// COPY PASTA

const UnstyledUnorderedList = styled('ul')`
  list-style: none;
  padding-left: 0;
  margin-bottom: 0 !important;
`;

const TagBarBackground = styled('div')<{widthPercent: string}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: ${p => p.theme.tagBar};
  border-radius: ${p => p.theme.borderRadius};
  width: ${p => p.widthPercent};
`;

const TagBarGlobalSelectionLink = styled('div')`
  position: relative;
  display: flex;
  line-height: 2.2;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(0.5)};
  padding: 0 ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  cursor: pointer;

  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline;
    ${TagBarBackground} {
      background: ${p => p.theme.tagBarHover};
    }
  }
`;

const TagBarLabel = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  flex-grow: 1;
  ${p => p.theme.overflowEllipsis}
`;

const TagBarCount = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  position: relative;
  padding-left: ${space(2)};
  padding-right: ${space(1)};
  font-variant-numeric: tabular-nums;
`;

const ViewMoreContainer = styled('div')`
  padding-top: ${space(1.5)};
  display: flex;
  justify-content: center;
`;

const ImgIcon = styled('img')`
  height: 16px;
  width: 16px;
`;

/// MOCK_DATA

const createSrcIcon = (src: string) => {
  return <ImgIcon src={src} />;
};

const sources = [
  {name: 'Direct / None', value: 100, icon: <IconLink size="sm" />},
  {name: 'GitHub', value: 50, icon: createSrcIcon(iconGithub)},
  {name: 'Discord', value: 25, icon: createSrcIcon(iconDiscord)},
  {name: 'Google', value: 10, icon: createSrcIcon(iconGoogle)},
  {name: 'Gitlab', value: 5, icon: createSrcIcon(iconGitlab)},
  {name: 'Jira', value: 1, icon: createSrcIcon(iconJira)},
];

const pagesTags: Tag[] = [
  {name: '/challenges/2024', value: 100},
  {name: '/intro', value: 50},
  {name: '/', value: 25},
  {name: '/challenges/2024/day/1', value: 10},
  {name: '/tos', value: 5},
];

const browsers = [
  {name: 'Chrome', value: 5300, icon: createSrcIcon(iconChrome)},
  {name: 'Safari', value: 2200, icon: createSrcIcon(iconSafari)},
  {name: 'Firefox', value: 878, icon: createSrcIcon(iconFirefox)},
  {name: 'Edge', value: 305, icon: createSrcIcon(iconEdge)},
  {name: 'Opera', value: 61, icon: createSrcIcon(iconOpera)},
  {name: 'Samsung Browser', value: 26, icon: <IconMobile size="sm" />},
];

const visits = [
  {
    value: 66,
    name: new Date('2024-01-01T00:00:00Z').getTime(),
  },
  {
    value: 78,
    name: new Date('2024-01-02T00:00:00Z').getTime(),
  },
  {
    value: 130,
    name: new Date('2024-01-03T00:00:00Z').getTime(),
  },
  {
    value: 99,
    name: new Date('2024-01-04T00:00:00Z').getTime(),
  },
  {
    value: 168,
    name: new Date('2024-01-05T00:00:00Z').getTime(),
  },
  {
    value: 189,
    name: new Date('2024-01-06T00:00:00Z').getTime(),
  },
  {
    value: 180,
    name: new Date('2024-01-07T00:00:00Z').getTime(),
  },
  {
    value: 210,
    name: new Date('2024-01-08T00:00:00Z').getTime(),
  },
  {
    value: 214,
    name: new Date('2024-01-09T00:00:00Z').getTime(),
  },
  {
    value: 156,
    name: new Date('2024-01-10T00:00:00Z').getTime(),
  },
  {
    value: 170,
    name: new Date('2024-01-11T00:00:00Z').getTime(),
  },
  {
    value: 160,
    name: new Date('2024-01-12T00:00:00Z').getTime(),
  },
  {
    value: 198,
    name: new Date('2024-01-13T00:00:00Z').getTime(),
  },
  {
    value: 213,
    name: new Date('2024-01-14T00:00:00Z').getTime(),
  },
  {
    value: 246,
    name: new Date('2024-01-15T00:00:00Z').getTime(),
  },
  {
    value: 280,
    name: new Date('2024-01-16T00:00:00Z').getTime(),
  },
];
