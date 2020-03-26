import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import SentryTypes from 'app/sentryTypes';
import Alert from 'app/components/alert';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import EventDataSection from 'app/components/events/eventDataSection';

const AlertUl = styled('ul')`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

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
    let href;
    let content;
    switch (suggestion.type) {
      case 'updateSdk':
        href = suggestion.sdkUrl;
        content = t(
          'update your SDK from version %s to version %s',
          event.sdk.version,
          suggestion.newSdkVersion
        );
        break;
      case 'changeSdk':
        href = suggestion.sdkUrl;
        content = tct('migrate to the [sdkName] SDK', {
          sdkName: <code>{suggestion.newSdkName}</code>,
        });
        break;
      case 'enableIntegration':
        href = suggestion.integrationUrl;
        content = t("enable the '%s' integration", suggestion.integrationName);
        break;
      default:
        return null;
    }

    if (!href) {
      return content;
    }

    return <ExternalLink href={href}>{content}</ExternalLink>;
  }

  render() {
    const {event, suggestion} = this.props;
    const title = this.getSuggestionTitle();

    if (suggestion.enables.length === 0) {
      return title;
    }

    return (
      <span>
        {title}
        {t(' so you can')}
        <AlertUl>
          {suggestion.enables.map(suggestion2 => (
            <li key={getSuggestionComponentKey(suggestion2)}>
              <EventSdkUpdateSuggestion event={event} suggestion={suggestion2} />
            </li>
          ))}
        </AlertUl>
      </span>
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
      <EventDataSection title={null} type="sdk-updates">
        {data.map(suggestion => (
          <Alert
            type="info"
            icon="icon-upgrade"
            key={getSuggestionComponentKey(suggestion)}
          >
            {t('We recommend you ')}
            <EventSdkUpdateSuggestion event={event} suggestion={suggestion} />
            {'.'}
          </Alert>
        ))}
      </EventDataSection>
    );
  }
}

export default EventSdkUpdates;
