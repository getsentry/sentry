import styled from '@emotion/styled';

import {EVENT_CHOICES} from './constants';
import SubscriptionBox from './subscriptionBox';

type Resource = (typeof EVENT_CHOICES)[number];

type Props = {
  events: string[];
  setEvents: (events: string[]) => void;
};

function SentryFunctionSubscriptions(props: Props) {
  const {events, setEvents} = props;

  function onChange(resource: Resource, checked: boolean) {
    if (checked && !events.includes(resource)) {
      setEvents(events.concat(resource));
    } else if (!checked && events.includes(resource)) {
      setEvents(events.filter(e => e !== resource));
    }
  }

  return (
    <SentryFunctionsSubscriptionGrid>
      {EVENT_CHOICES.map(resource => (
        <SubscriptionBox
          key={resource}
          disabledFromPermissions={false}
          webhookDisabled={false}
          checked={props.events.includes(resource)}
          resource={resource}
          onChange={onChange}
          isNew={false}
        />
      ))}
    </SentryFunctionsSubscriptionGrid>
  );
}

export default SentryFunctionSubscriptions;
const SentryFunctionsSubscriptionGrid = styled('div')`
  display: grid;
  grid-template: auto / 1fr 1fr 1fr;
  @media (max-width: ${props => props.theme.breakpoints.large}) {
    grid-template: 1fr 1fr 1fr / auto;
  }
`;
