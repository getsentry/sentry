import * as React from 'react';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';

import {Relay, RelayActivity} from 'app/types';
import space from 'app/styles/space';

import {getRelaysByPublicKey} from './utils';
import CardHeader from './cardHeader';
import ActivityList from './activityList';
import WaitingActivity from './waitingActivity';

type CardHeaderProps = React.ComponentProps<typeof CardHeader>;
type WaitingActivityProps = React.ComponentProps<typeof WaitingActivity>;

type Props = {
  relays: Array<Relay>;
  relayActivities: Array<RelayActivity>;
} & Pick<CardHeaderProps, 'onDelete' | 'onEdit'> &
  Pick<WaitingActivityProps, 'onRefresh'>;

const List = ({relays, relayActivities, onRefresh, onDelete, onEdit}: Props) => {
  const orderedRelays = orderBy(relays, relay => relay.created, ['desc']);

  const relaysByPublicKey = getRelaysByPublicKey(orderedRelays, relayActivities);

  const renderCardContent = (activities: Array<RelayActivity>) => {
    if (!activities.length) {
      return <WaitingActivity onRefresh={onRefresh} />;
    }

    return <ActivityList activities={activities} />;
  };

  return (
    <Wrapper>
      {Object.keys(relaysByPublicKey).map(relayByPublicKey => {
        const {name, description, created, activities} = relaysByPublicKey[
          relayByPublicKey
        ];
        return (
          <Card key={relayByPublicKey}>
            <CardHeader
              publicKey={relayByPublicKey}
              name={name}
              description={description}
              created={created}
              onEdit={onEdit}
              onDelete={onDelete}
            />
            {renderCardContent(activities)}
          </Card>
        );
      })}
    </Wrapper>
  );
};

export default List;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(3)};
`;

const Card = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
