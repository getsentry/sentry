import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Card from 'app/components/card';
import Link from 'app/components/links/link';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias, WebVital} from 'app/utils/discover/fields';
import {formatPercentage} from 'app/utils/formatters';
import VitalsCardsDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';

import {
  vitalAbbreviations,
  vitalDetailRouteWithQuery,
  vitalsBaseFields,
  vitalsThresholdFields,
} from './vitalDetail/utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
};

export default function VitalsCards(props: Props) {
  const {eventView, organization, location} = props;
  const vitalsView = eventView.clone();

  const shownVitals = [
    WebVital.FP,
    WebVital.FCP,
    WebVital.LCP,
    WebVital.FID,
    WebVital.CLS,
  ];

  return (
    <VitalsCardsDiscoverQuery
      eventView={vitalsView}
      orgSlug={organization.slug}
      location={location}
    >
      {({isLoading, tableData}) => (
        <VitalsContainer>
          {shownVitals.map(vitalName => (
            <LinkedVitalsCard
              key={vitalName}
              vitalName={vitalName}
              tableData={tableData}
              isLoading={isLoading}
              {...props}
            />
          ))}
        </VitalsContainer>
      )}
    </VitalsCardsDiscoverQuery>
  );
}

const VitalsContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

type CardProps = Props & {
  vitalName: WebVital;
  tableData: any;
  isLoading?: boolean;
  noBorder?: boolean;
};

const NonPanel = styled('div')`
  flex-grow: 1;
`;

const StyledVitalCard = styled(Card)`
  color: ${p => p.theme.textColor};
  padding: ${space(1.5)} ${space(2)} ${space(2)} ${space(2)};

  &:focus,
  &:hover {
    color: ${p => p.theme.textColor};
    top: -1px;
  }
`;

export function LinkedVitalsCard(props: CardProps) {
  const {vitalName} = props;
  return (
    <VitalLink {...props} vitalName={vitalName}>
      <VitalsCard {...props} />
    </VitalLink>
  );
}

export function VitalsCard(props: CardProps) {
  const {isLoading, tableData, vitalName, noBorder} = props;

  const measurement = vitalAbbreviations[vitalName];

  const Container = noBorder ? NonPanel : StyledVitalCard;

  if (isLoading || !tableData || !tableData.data || !tableData.data[0]) {
    return <BlankCard noBorder={noBorder} measurement={measurement} />;
  }

  const result = tableData.data[0];
  const base = result[getAggregateAlias(vitalsBaseFields[vitalName])];

  if (!base) {
    return <BlankCard noBorder={noBorder} measurement={measurement} />;
  }

  const thresholdCount: number =
    parseFloat(result[getAggregateAlias(vitalsThresholdFields[vitalName])]) || 0;
  const baseCount: number = parseFloat(base) || Number.MIN_VALUE;

  const value = formatPercentage(1 - thresholdCount / baseCount);

  return (
    <Container interactive>
      <CardTitle>{t(`${measurement} Passing`)}</CardTitle>
      <CardValue>{value}</CardValue>
    </Container>
  );
}

type BlankCardProps = {
  noBorder?: boolean;
  measurement?: string;
};

const BlankCard = (props: BlankCardProps) => {
  const Container = props.noBorder ? NonPanel : StyledVitalCard;
  return (
    <Container interactive>
      <CardTitle>{t(`${props.measurement} Passing`)}</CardTitle>
      <CardValue>{'\u2014'}</CardValue>
    </Container>
  );
};

type VitalLinkProps = Props & {
  vitalName: WebVital;
  children: React.ReactNode;
};

const VitalLink = (props: VitalLinkProps) => {
  const {organization, eventView, vitalName, children} = props;

  const view = eventView.clone();

  const target = vitalDetailRouteWithQuery({
    orgSlug: organization.slug,
    query: view.generateQueryStringObject(),
    vitalName,
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

const CardTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.5)};
`;
const CardValue = styled('div')`
  font-size: 32px;
`;
