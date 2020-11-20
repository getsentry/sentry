import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import EventView from 'app/utils/discover/eventView';
import {Organization} from 'app/types';
import {WebVital} from 'app/utils/discover/fields';
import VitalsCardDiscoverQuery from 'app/views/performance/vitalDetail/vitalsCardsDiscoverQuery';
import space from 'app/styles/space';

import {VitalsCard} from '../vitals-cards';
import {vitalDescription} from './utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  vitalName: WebVital;
};

export default function vitalInfo(props: Props) {
  const {vitalName, eventView, organization, location} = props;
  const description = vitalDescription[vitalName];
  return (
    <Container>
      <VitalsCardDiscoverQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        onlyVital={vitalName}
      >
        {({isLoading, tableData}) => (
          <React.Fragment>
            <VitalsCard tableData={tableData} isLoading={isLoading} {...props} noBorder />
          </React.Fragment>
        )}
      </VitalsCardDiscoverQuery>
      <Description>{description}</Description>
    </Container>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(4)};
  padding-top: ${space(1)};
  padding-bottom: ${space(4)};
`;

const Description = styled('div')``;
