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

const SdkUpdates = ({event}: Props) => {
  const {sdkUpdates} = event;

  const eventDataSectinContent = sdkUpdates
    .map((sdkUpdate, index) => {
      const suggestion = getSuggestion({suggestion: sdkUpdate, event});

      if (!suggestion) {
        return null;
      }

      return (
        <Alert key={index} type="info" icon={<IconUpgrade />}>
          {tct('We recommend you [suggestion]', {suggestion})}
        </Alert>
      );
    })
    .filter(alert => !!alert);

  if (!eventDataSectinContent.length) {
    return null;
  }

  return (
    <EventDataSection title={null} type="sdk-updates">
      {eventDataSectinContent}
    </EventDataSection>
  );
};

export default SdkUpdates;
