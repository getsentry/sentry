import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';
import {Organization} from 'app/types';
import {Panel} from 'app/components/panels';
import {formatPercentage} from 'app/utils/formatters';
import VitalsCardsDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';
import {WebVital} from 'app/utils/discover/fields';
import Link from 'app/components/links/link';
import {t} from 'app/locale';

import {vitalAbbreviations, vitalDetailRouteWithQuery} from './vitalDetail/utils';

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
        <React.Fragment>
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
        </React.Fragment>
      )}
    </VitalsCardsDiscoverQuery>
  );
}

const VitalsContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};
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

const Card = styled(Panel)`
  padding: ${space(2)};
  cursor: pointer;
`;

const StyledQueryCard = styled(Card)`
  &:focus,
  &:hover {
    top: -1px;
    box-shadow: 0px 0px 0px 6px rgba(209, 202, 216, 0.2);
    position: relative;
    outline: none;
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

  const Container = noBorder ? NonPanel : StyledQueryCard;

  if (isLoading || !tableData || !tableData.data || !tableData.data[0]) {
    return (
      <Container>
        <CardTitle>{t(`${measurement} Passing`)}</CardTitle>
        <CardValue>-</CardValue>
      </Container>
    );
  }

  const result = tableData.data[0];

  const value = formatPercentage(
    1 - parseFloat(result[`${measurement?.toLowerCase()}_percentage`] || 1)
  );

  return (
    <Container>
      <CardTitle>Total Passing {measurement}</CardTitle>
      <CardValue>{value}</CardValue>
    </Container>
  );
}

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
    <StyledVitalLink
      to={target}
      data-test-id={`vitals-linked-card-${vitalAbbreviations[vitalName]}`}
    >
      {children}
    </StyledVitalLink>
  );
};

const StyledVitalLink = styled(Link)`
  color: ${p => p.theme.textColor};
`;

const CardTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
`;
const CardValue = styled('div')`
  font-size: 30px;
`;
