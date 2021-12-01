import Alert from 'sentry/components/alert';
import EventDataSection from 'sentry/components/events/eventDataSection';
import {IconUpgrade} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Event} from 'sentry/types/event';
import getSdkUpdateSuggestion from 'sentry/utils/getSdkUpdateSuggestion';

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
