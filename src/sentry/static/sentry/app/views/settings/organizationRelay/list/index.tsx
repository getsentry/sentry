import React from 'react';
import styled from '@emotion/styled';

import {Relay, RelayActivity} from 'app/types';
import space from 'app/styles/space';
import LoadingIndicator from 'app/components/loadingIndicator';

import {getRelaysByPublicKey} from './utils';
import CardHeader from './cardHeader';
import ActivityList from './activityList';
import WaitingActivity from './waitingActivity';

type CardHeaderProps = React.ComponentProps<typeof CardHeader>;
type WaitingActivityProps = React.ComponentProps<typeof WaitingActivity>;

type Props = {
  isLoading: boolean;
  relays: Array<Relay>;
  relayActivities: Array<RelayActivity>;
} & Pick<CardHeaderProps, 'onDelete' | 'onEdit'> &
  Pick<WaitingActivityProps, 'onRefresh'>;

const List = ({
  relays,
  relayActivities,
  onRefresh,
  onDelete,
  onEdit,
  isLoading,
}: Props) => {
  const relaysByPublicKey = getRelaysByPublicKey(relays, relayActivities);

  const renderCardContent = (activities: Array<RelayActivity>) => {
    if (isLoading) {
      return <LoadingIndicator />;
    }

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
