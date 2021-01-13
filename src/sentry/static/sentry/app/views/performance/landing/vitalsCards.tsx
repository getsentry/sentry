import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Card from 'app/components/card';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {decodeList} from 'app/utils/queryString';
import VitalsCardsDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';

import {HeaderTitle} from '../styles';
import ColorBar from '../vitalDetail/colorBar';
import {
  vitalAbbreviations,
  vitalDescription,
  vitalDetailRouteWithQuery,
  vitalMap,
  vitalsBaseFields,
  vitalsMehFields,
  vitalsP75Fields,
  vitalsPoorFields,
  VitalState,
  vitalStateColors,
} from '../vitalDetail/utils';
import VitalPercents from '../vitalDetail/vitalPercents';

// Temporary list of platforms to only show web vitals for.
const VITALS_PLATFORMS = [
  'javascript',
  'javascript-react',
  'javascript-angular',
  'javascript-angularjs',
  'javascript-backbone',
  'javascript-ember',
  'javascript-gatsby',
  'javascript-vue',
];

type VitalsCardsProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  frontendOnly?: boolean;
};

export function FrontendCards(props: VitalsCardsProps) {
  const {eventView, location, organization, projects, frontendOnly = false} = props;

  if (frontendOnly) {
    const isFrontend = eventView.project.some(projectId =>
      VITALS_PLATFORMS.includes(
        projects.find(project => project.id === `${projectId}`)?.platform || ''
      )
    );

    if (!isFrontend) {
      return null;
    }
  }

  const vitals = [WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS];

  return (
    <VitalsCardsDiscoverQuery
      eventView={eventView}
      location={location}
      orgSlug={organization.slug}
      vitals={vitals}
    >
      {({isLoading, tableData}) => {
        const result = tableData?.data?.[0];
        return (
          <VitalsContainer>
            {vitals.map(vitalName => {
              const target = vitalDetailRouteWithQuery({
                orgSlug: organization.slug,
                query: eventView.generateQueryStringObject(),
                vitalName,
                projectID: decodeList(location.query.project),
              });

              return (
                <Link
                  key={vitalName}
                  to={target}
                  data-test-id={`vitals-linked-card-${vitalAbbreviations[vitalName]}`}
                >
                  <FrontendCard isLoading={isLoading} result={result} vital={vitalName} />
                </Link>
              );
            })}
          </VitalsContainer>
        );
      }}
    </VitalsCardsDiscoverQuery>
  );
}

const VitalsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  grid-column-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
`;

type FrontendCardProps = {
  isLoading: boolean;
  result: any;
  vital: WebVital;
};

function FrontendCard(props: FrontendCardProps) {
  const {isLoading, result, vital} = props;

  const value = isLoading ? '\u2014' : getP75(result, vital);
  const chart = <VitalBar isLoading={isLoading} vital={vital} result={result} />;

  return (
    <VitalCard
      title={vitalMap[vital] ?? ''}
      tooltip={vitalDescription[vital] ?? ''}
      value={isLoading ? '\u2014' : value}
      chart={chart}
    />
  );
}

type VitalBarProps = {
  isLoading: boolean;
  result: any;
  vital: WebVital | WebVital[];
  value?: string;
  showBar?: boolean;
  showStates?: boolean;
  showDurationDetail?: boolean;
  showVitalPercentNames?: boolean;
};

export function VitalBar(props: VitalBarProps) {
  const {
    isLoading,
    result,
    vital,
    value,
    showBar = true,
    showStates = false,
    showDurationDetail = false,
    showVitalPercentNames = false,
  } = props;

  if (isLoading) {
    return showStates ? <Placeholder height="48px" /> : null;
  }

  const emptyState = showStates ? (
    <EmptyStateWarning small>{t('No data available')}</EmptyStateWarning>
  ) : null;

  if (!result) {
    return emptyState;
  }

  const counts: Counts = {
    poorCount: 0,
    mehCount: 0,
    goodCount: 0,
    baseCount: 0,
  };
  const vitals = Array.isArray(vital) ? vital : [vital];
  vitals.forEach(vitalName => {
    const c = getCounts(result, vitalName);
    Object.keys(counts).forEach(countKey => (counts[countKey] += c[countKey]));
  });

  if (!counts.baseCount) {
    return emptyState;
  }

  const p75: React.ReactNode = Array.isArray(vital)
    ? null
    : value ?? getP75(result, vital);
  const percents = getPercentsFromCounts(counts);
  const colorStops = getColorStopsFromPercents(percents);

  return (
    <React.Fragment>
      {showBar && <ColorBar colorStops={colorStops} />}
      <BarDetail>
        {showDurationDetail && p75 && (
          <div>
            {t('The p75 for all transactions is ')}
            <strong>{p75}</strong>
          </div>
        )}
        <VitalPercents
          percents={percents}
          showVitalPercentNames={showVitalPercentNames}
        />
      </BarDetail>
    </React.Fragment>
  );
}

type VitalCardProps = {
  title: string;
  tooltip: string;
  value: string;
  chart: React.ReactNode;
};

function VitalCard(props: VitalCardProps) {
  const {chart, title, tooltip, value} = props;
  return (
    <StyledCard interactive>
      <HeaderTitle>
        <OverflowEllipsis>{t(title)}</OverflowEllipsis>
        <QuestionTooltip size="sm" position="top" title={tooltip} />
      </HeaderTitle>
      <CardValue>{value}</CardValue>
      {chart}
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  color: ${p => p.theme.textColor};
  padding: ${space(2)} ${space(3)};
  align-items: flex-start;
  min-height: 150px;
  margin-bottom: ${space(2)};
`;

function getP75(result: any, vitalName: WebVital): string {
  const p75 = result?.[getAggregateAlias(vitalsP75Fields[vitalName])] ?? null;
  if (p75 === null) {
    return '\u2014';
  } else {
    return vitalName === WebVital.CLS ? p75.toFixed(2) : `${p75.toFixed(0)}ms`;
  }
}

type Counts = {
  poorCount: number;
  mehCount: number;
  goodCount: number;
  baseCount: number;
};

function getCounts(result: any, vitalName: WebVital): Counts {
  const base = result[getAggregateAlias(vitalsBaseFields[vitalName])];
  const poorCount: number =
    parseFloat(result[getAggregateAlias(vitalsPoorFields[vitalName])]) || 0;
  const mehTotal: number =
    parseFloat(result[getAggregateAlias(vitalsMehFields[vitalName])]) || 0;
  const mehCount = mehTotal - poorCount;
  const baseCount: number = parseFloat(base) || 0;

  const goodCount: number = baseCount - mehCount - poorCount;

  return {
    poorCount,
    mehCount,
    goodCount,
    baseCount,
  };
}

type Percent = {
  vitalState: VitalState;
  percent: number;
};

function getPercentsFromCounts({poorCount, mehCount, goodCount, baseCount}) {
  const poorPercent = poorCount / baseCount;
  const mehPercent = mehCount / baseCount;
  const goodPercent = goodCount / baseCount;

  const percents: Percent[] = [
    {
      vitalState: VitalState.GOOD,
      percent: goodPercent,
    },
    {
      vitalState: VitalState.MEH,
      percent: mehPercent,
    },
    {
      vitalState: VitalState.POOR,
      percent: poorPercent,
    },
  ];

  return percents;
}

function getColorStopsFromPercents(percents: Percent[]) {
  return percents.map(({percent, vitalState}) => ({
    percent,
    color: vitalStateColors[vitalState],
  }));
}

const BarDetail = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    justify-content: space-between;
  }
`;

const CardValue = styled('div')`
  font-size: 32px;
  margin-top: ${space(1)};
  margin-bottom: ${space(1.5)};
`;

const OverflowEllipsis = styled('div')`
  ${overflowEllipsis};
`;
