import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';

import {EVENT_CHOICES} from './constants';
import SubscriptionBox from './subscriptionBox';

type Resource = typeof EVENT_CHOICES[number];

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
    <Panel>
      <PanelHeader>{t('Webhooks')}</PanelHeader>
      <PanelBody>
        <SentryFunctionsSubscriptionGrid>
          {EVENT_CHOICES.map(resource => (
            <SubscriptionBox
              key={resource}
              disabledFromPermissions={false}
              webhookDisabled={false}
              checked={props.events.includes(resource)}
              resource={resource}
              onChange={onChange}
              isNew={resource === 'comment'}
            />
          ))}
        </SentryFunctionsSubscriptionGrid>
      </PanelBody>
    </Panel>
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
