import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import space from 'app/styles/space';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import VitalsCardDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';

import {VitalsCard} from '../vitalsCards';

import {vitalDescription} from './utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  vitalName: WebVital;
  hideBar?: boolean;
  hideDescription?: boolean;
  hideVitalPercentNames?: boolean;
};

export default function vitalInfo(props: Props) {
  const {
    vitalName,
    eventView,
    organization,
    location,
    hideVitalPercentNames,
    hideDescription,
  } = props;
  const description = vitalDescription[vitalName];
  return (
    <Container>
      {!hideDescription && <Description>{description}</Description>}
      <VitalsCardDiscoverQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        onlyVital={vitalName}
      >
        {({isLoading, tableData}) => (
          <React.Fragment>
            <VitalsCard
              tableData={tableData}
              isLoading={isLoading}
              {...props}
              noBorder
              showVitalPercentNames={!hideVitalPercentNames}
            />
          </React.Fragment>
        )}
      </VitalsCardDiscoverQuery>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  gap: ${space(3)};
  margin-bottom: ${space(3)};
`;

const Description = styled('div')``;
