import React from 'react';
import PropTypes from 'prop-types';
import SentryTypes from 'app/sentryTypes';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';

import {t} from 'app/locale';

export const EnableIntegrationSuggestion = PropTypes.shape({
  type: PropTypes.string,
  integrationName: PropTypes.string,
  integrationUrl: PropTypes.string,
});

export const UpdateSdkSuggestion = PropTypes.shape({
  type: PropTypes.string,
  sdkName: PropTypes.string,
  newSdkVersion: PropTypes.string,
  sdkUrl: PropTypes.string,
});

export const ChangeSdkSuggestion = PropTypes.shape({
  type: PropTypes.string,
  newSdkName: PropTypes.string,
  sdkUrl: PropTypes.string,
});

export const Suggestion = PropTypes.oneOfType([
  EnableIntegrationSuggestion,
  UpdateSdkSuggestion,
  ChangeSdkSuggestion,
]);

function getSuggestionComponentKey(suggestion) {
  return JSON.stringify(suggestion, Object.keys(suggestion).sort());
}

class EventSdkUpdateSuggestion extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    suggestion: Suggestion.isRequired,
  };

  getSuggestionTitle() {
    const {event, suggestion} = this.props;
    switch (suggestion.type) {
      case 'updateSdk':
        return (
          <ExternalLink href={suggestion.sdkUrl}>
            {t(
              'Update your SDK from version %s to version %s',
              event.sdk.version,
              suggestion.newSdkVersion
            )}
          </ExternalLink>
        );
      case 'changeSdk':
        return (
          <ExternalLink href={suggestion.sdkUrl}>
            {t("Migrate to the '%s' SDK", suggestion.newSdkName)}
          </ExternalLink>
        );
      case 'enableIntegration':
        return (
          <ExternalLink href={suggestion.integrationUrl}>
            {t("Enable the '%s' integration", suggestion.integrationName)}
          </ExternalLink>
        );
      default:
        return null;
    }
  }

  render() {
    const {suggestion} = this.props;
    const title = this.getSuggestionTitle();

    if (suggestion.enables.length == 0) {
      return title;
    }

    return (
      <div>
        {title}
        {t(' so you can: ')}
        <ul>
          {suggestion.enables.map((suggestion2, i) => {
            return (
              <li key={getSuggestionComponentKey(suggestion2)}>
                <EventSdkUpdateSuggestion event={event} suggestion={suggestion2} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

class EventSdkUpdates extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  render() {
    const {event} = this.props;
    const data = event.sdkUpdates;

    return (
      <div>
        {data.map(suggestion => {
          return (
            <Alert
              type="info"
              icon="icon-upgrade"
              key={getSuggestionComponentKey(suggestion)}
            >
              {t('We recommend to ')}
              <EventSdkUpdateSuggestion event={event} suggestion={suggestion} />
            </Alert>
          );
        })}
      </div>
    );
  }
}

export default EventSdkUpdates;
