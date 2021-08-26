import Alert from 'app/components/alert';
import EventDataSection from 'app/components/events/eventDataSection';
import {IconUpgrade} from 'app/icons';
import {t, tct} from 'app/locale';
import {Event} from 'app/types/event';
import getSdkUpdateSuggestion from 'app/utils/getSdkUpdateSuggestion';

type Props = {
  event: Omit<Event, 'sdkUpdates'> & {
    sdkUpdates: NonNullable<Event['sdkUpdates']>;
  };
};

const SdkUpdates = ({event}: Props) => {
  const {sdkUpdates} = event;

  const eventDataSectinContent = sdkUpdates
    .map((sdkUpdate, index) => {
      const suggestion = getSdkUpdateSuggestion({suggestion: sdkUpdate, sdk: event.sdk});

      if (!suggestion) {
        return null;
      }

      return (
        <Alert key={index} type="info" icon={<IconUpgrade />}>
          {tct('We recommend you [suggestion] ', {suggestion})}
          {sdkUpdate.type === 'updateSdk' &&
            t('(All sentry packages should be updated and their versions should match)')}
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
