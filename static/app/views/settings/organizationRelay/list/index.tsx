import orderBy from 'lodash/orderBy';

import {Relay, RelayActivity} from 'sentry/types';

import ActivityList from './activityList';
import CardHeader from './cardHeader';
import {getRelaysByPublicKey} from './utils';
import WaitingActivity from './waitingActivity';

type CardHeaderProps = React.ComponentProps<typeof CardHeader>;
type WaitingActivityProps = React.ComponentProps<typeof WaitingActivity>;

type Props = {
  disabled: boolean;
  relayActivities: Array<RelayActivity>;
  relays: Array<Relay>;
} & Pick<CardHeaderProps, 'onDelete' | 'onEdit'> &
  Pick<WaitingActivityProps, 'onRefresh'>;

function List({relays, relayActivities, onRefresh, onDelete, onEdit, disabled}: Props) {
  const orderedRelays = orderBy(relays, relay => relay.created, ['desc']);

  const relaysByPublicKey = getRelaysByPublicKey(orderedRelays, relayActivities);

  const renderCardContent = (activities: Array<RelayActivity>) => {
    if (!activities.length) {
      return <WaitingActivity onRefresh={onRefresh} disabled={disabled} />;
    }

    return <ActivityList activities={activities} />;
  };

  return (
    <div>
      {Object.keys(relaysByPublicKey).map(relayByPublicKey => {
        const {name, description, created, activities} =
          relaysByPublicKey[relayByPublicKey];
        return (
          <div key={relayByPublicKey}>
            <CardHeader
              publicKey={relayByPublicKey}
              name={name}
              description={description}
              created={created}
              onEdit={onEdit}
              onDelete={onDelete}
              disabled={disabled}
            />
            {renderCardContent(activities)}
          </div>
        );
      })}
    </div>
  );
}

export default List;
