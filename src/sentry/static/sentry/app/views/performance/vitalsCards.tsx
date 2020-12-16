import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Card from 'app/components/card';
import Link from 'app/components/links/link';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {decodeList} from 'app/utils/queryString';
import withProjects from 'app/utils/withProjects';
import VitalsCardsDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';

import ColorBar from './vitalDetail/colorBar';
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
} from './vitalDetail/utils';
import VitalPercents from './vitalDetail/vitalPercents';
import {HeaderTitle} from './styles';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  showVitalPercentNames?: boolean;
  showDurationDetail?: boolean;
  hasCondensedVitals?: boolean;
  projects: Project[];
};

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

function VitalsCards(props: Props) {
  const {eventView, organization, location, projects} = props;
  const vitalsView = eventView.clone();

  const showVitalsCard = vitalsView.project.some(projectId =>
    VITALS_PLATFORMS.includes(
      projects.find(project => project.id === `${projectId}`)?.platform || ''
    )
  );

  if (!showVitalsCard) {
    return null;
  }

  const shownVitals = [WebVital.FCP, WebVital.LCP, WebVital.FID, WebVital.CLS];

  return (
    <VitalsCardsDiscoverQuery
      eventView={vitalsView}
      orgSlug={organization.slug}
      location={location}
    >
      {({isLoading, tableData}) => (
        <VitalsContainer>
          {props.hasCondensedVitals ? (
            <CondensedVitalsCard
              tableData={tableData}
              isLoading={isLoading}
              {...props}
              condensedVitals={shownVitals}
            />
          ) : (
            shownVitals.map(vitalName => (
              <LinkedVitalsCard
                key={vitalName}
                vitalName={vitalName}
                tableData={tableData}
                isLoading={isLoading}
                {...props}
              />
            ))
          )}
        </VitalsContainer>
      )}
    </VitalsCardsDiscoverQuery>
  );
}

export default withProjects(VitalsCards);

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

type CardProps = Props & {
  vitalName: WebVital;
  tableData: any;
  isLoading?: boolean;
  noBorder?: boolean;
  hideBar?: boolean;
};

const NonPanel = styled('div')``;

const VitalCard = styled(Card)`
  color: ${p => p.theme.textColor};
  padding: ${space(2)} ${space(3)};
  align-items: flex-start;
  min-height: 150px;
  margin-bottom: ${space(2)};
`;

export function LinkedVitalsCard(props: CardProps) {
  const {vitalName} = props;
  return (
    <VitalLink {...props} vitalName={vitalName}>
      <VitalsCard {...props} />
    </VitalLink>
  );
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
  const baseCount: number = parseFloat(base) || Number.MIN_VALUE;

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

export function VitalsCard(props: CardProps) {
  const {isLoading, tableData, vitalName, noBorder, hideBar} = props;

  const measurement = vitalMap[vitalName];

  if (isLoading || !tableData || !tableData.data || !tableData.data[0]) {
    return <BlankCard noBorder={noBorder} measurement={measurement} />;
  }

  const result = tableData.data[0];
  const base = result[getAggregateAlias(vitalsBaseFields[vitalName])];

  if (!base) {
    return <BlankCard noBorder={noBorder} measurement={measurement} />;
  }

  const percents = getPercentsFromCounts(getCounts(result, vitalName));
  const p75: number =
    parseFloat(result[getAggregateAlias(vitalsP75Fields[vitalName])]) || 0;
  const value = vitalName === WebVital.CLS ? p75.toFixed(2) : p75.toFixed(0);

  return (
    <VitalsCardContent
      percents={percents}
      showVitalPercentNames={props.showVitalPercentNames}
      showDurationDetail={props.showDurationDetail}
      title={measurement}
      titleDescription={vitalName ? vitalDescription[vitalName] || '' : ''}
      value={`${value}${vitalName === WebVital.CLS ? '' : t('ms')}`}
      noBorder={noBorder}
      hideBar={hideBar}
    />
  );
}

type CondensedCardProps = Props & {
  tableData: any;
  isLoading?: boolean;
  condensedVitals: WebVital[];
};

/**
 * To aggregate and visualize all vital counts in returned data.
 */
function CondensedVitalsCard(props: CondensedCardProps) {
  const {isLoading, tableData} = props;

  if (isLoading || !tableData || !tableData.data || !tableData.data[0]) {
    return <BlankCard noBorder />;
  }

  const result = tableData.data[0];

  const vitals = props.condensedVitals;

  const allCounts: Counts = {
    poorCount: 0,
    mehCount: 0,
    goodCount: 0,
    baseCount: 0,
  };
  vitals.forEach(vitalName => {
    const counts = getCounts(result, vitalName);
    Object.keys(counts).forEach(countKey => (allCounts[countKey] += counts[countKey]));
  });

  if (!allCounts.baseCount) {
    return <BlankCard noBorder />;
  }

  const percents = getPercentsFromCounts(allCounts);

  return (
    <VitalsCardContent
      noBorder
      percents={percents}
      showVitalPercentNames={props.showVitalPercentNames}
      showDurationDetail={props.showDurationDetail}
    />
  );
}

type CardContentProps = {
  percents: Percent[];
  title?: string;
  titleDescription?: string;
  value?: string;
  noBorder?: boolean;
  showVitalPercentNames?: boolean;
  showDurationDetail?: boolean;
  hideBar?: boolean;
};

function VitalsCardContent(props: CardContentProps) {
  const {
    percents,
    noBorder,
    title,
    titleDescription,
    value,
    showVitalPercentNames,
    showDurationDetail,
    hideBar,
  } = props;
  const Container = noBorder ? NonPanel : VitalCard;
  const colorStops = getColorStopsFromPercents(percents);

  return (
    <Container interactive>
      {noBorder || (
        <HeaderTitle>
          <OverflowEllipsis>{t(`${title}`)}</OverflowEllipsis>
          <QuestionTooltip size="sm" position="top" title={titleDescription} />
        </HeaderTitle>
      )}
      {noBorder || <CardValue>{value}</CardValue>}
      {!hideBar && <ColorBar colorStops={colorStops} />}
      <BarDetail>
        {showDurationDetail && (
          <div>
            {t('The p75 for all transactions is ')}
            <strong>{value}</strong>
          </div>
        )}
        <VitalPercents
          percents={percents}
          showVitalPercentNames={showVitalPercentNames}
        />
      </BarDetail>
    </Container>
  );
}

type BlankCardProps = {
  noBorder?: boolean;
  measurement?: string;
};

const BlankCard = (props: BlankCardProps) => {
  const Container = props.noBorder ? NonPanel : VitalCard;
  return (
    <Container interactive>
      {props.noBorder || (
        <HeaderTitle>
          <OverflowEllipsis>{t(`${props.measurement}`)}</OverflowEllipsis>
        </HeaderTitle>
      )}
      <CardValue>{'\u2014'}</CardValue>
    </Container>
  );
};

type VitalLinkProps = Props & {
  vitalName: WebVital;
  children: React.ReactNode;
};

const VitalLink = (props: VitalLinkProps) => {
  const {organization, eventView, vitalName, children, location} = props;

  const view = eventView.clone();

  const target = vitalDetailRouteWithQuery({
    orgSlug: organization.slug,
    query: view.generateQueryStringObject(),
    vitalName,
    projectID: decodeList(location.query.project),
  });

  return (
    <Link
      to={target}
      data-test-id={`vitals-linked-card-${vitalAbbreviations[vitalName]}`}
    >
      {children}
    </Link>
  );
};

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
