import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import EventDataSection from 'app/components/events/eventDataSection';
import {IconUpgrade} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
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

      const isSdkJavascript =
        sdkUpdate.type === 'updateSdk' &&
        sdkUpdate.sdkName.startsWith('sentry.javascript');

      return (
        <Alert key={index} type="info" icon={<IconUpgrade />}>
          {tct('We recommend you [suggestion]', {suggestion})}
          {isSdkJavascript && (
            <JavascriptInfo>
              {t(
                'Make sure all sentry.javascript.* packages are updated and their versions match'
              )}
            </JavascriptInfo>
          )}
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

const JavascriptInfo = styled('div')`
  margin-top: ${space(1)};
  text-decoration: underline;
`;
