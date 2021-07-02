import EventDataSection from 'app/components/events/eventDataSection';
import {tct} from 'app/locale';
import {SdkSuggestionType} from 'app/types';
import {Event} from 'app/types/event';
import getSdkUpdateSuggestion from 'app/utils/getSdkUpdateSuggestion';

import SdkAlert from './sdkAlert';

type Props = {
  event: Event;
};

function SdkUpdates({event}: Props) {
  const {sdkUpdates = [], sdk} = event;

  if (!sdkUpdates.length) {
    return null;
  }

  const eventDataSectinContent = sdkUpdates
    .map((sdkUpdate, index) => {
      if (
        !!sdk?.name.includes('raven') &&
        sdkUpdate.type === SdkSuggestionType.CHANGE_SDK
      ) {
        const suggestion = getSdkUpdateSuggestion({
          suggestion: sdkUpdate,
          capitalized: true,
          sdk,
        });

        if (!suggestion) {
          return undefined;
        }

        return (
          <SdkAlert
            key={index}
            type={sdkUpdate.type}
            suggestion={tct('Installations of raven are now out of date. [suggestion]', {
              suggestion,
            })}
            withGoToBroadcastAction
          />
        );
      }

      const suggestion = getSdkUpdateSuggestion({suggestion: sdkUpdate, sdk});

      if (!suggestion) {
        return undefined;
      }

      return (
        <SdkAlert
          key={index}
          type={sdkUpdate.type}
          suggestion={tct('We recommend you [suggestion]', {suggestion})}
          withGoToBroadcastAction={
            sdkUpdate.type !== SdkSuggestionType.ENABLE_INTEGRATION
          }
        />
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
}

export default SdkUpdates;
