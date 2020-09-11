import React from 'react';

import Alert from 'app/components/alert';
import {IconUpgrade} from 'app/icons';
import {tct} from 'app/locale';
import EventDataSection from 'app/components/events/eventDataSection';
import {Event} from 'app/types';

import getSuggestion from './getSuggestion';

type Props = {
  event: Omit<Event, 'sdkUpdates'> & {
    sdkUpdates: NonNullable<Event['sdkUpdates']>;
  };
};

const SDKUpdates = ({event}: Props) => {
  const {sdkUpdates} = event;

  return (
    <EventDataSection title={null} type="sdk-updates">
      {sdkUpdates.map((sdkUpdate, index) => {
        const suggestion = getSuggestion({suggestion: sdkUpdate, event});

        if (!suggestion) {
          return null;
        }

        return (
          <Alert key={index} type="info" icon={<IconUpgrade />}>
            {tct('We recommend you [suggestion].', {suggestion})}
          </Alert>
        );
      })}
    </EventDataSection>
  );
};

export default SDKUpdates;
