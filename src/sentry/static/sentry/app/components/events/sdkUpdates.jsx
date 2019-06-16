import React from 'react';
import PropTypes from 'prop-types';
import SentryTypes from 'app/sentryTypes';

import {t} from 'app/locale';

class EventSdkUpdateSuggestion extends React.Component {
  static propTypes = {
    suggestion: PropTypes.object.isRequired,
  };

  getSuggestionTitle() {
    const {suggestion} = this.props;
    switch (suggestion.type) {
      case 'updateSdk':
        return <a href={suggestion.sdkUrl}>{t('update your SDK')}</a>;
      case 'changeSdk':
        return (
          <a href={suggestion.sdkUrl}>
            {t("migrate to the '%s' SDK", suggestion.newSdkName)}
          </a>
        );
      case 'enableIntegration':
        return (
          <a href={suggestion.integrationUrl}>
            {t("enable the '%s' integration", suggestion.integrationName)}
          </a>
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
      <span>
        {title}
        {t(' so you can: ')}
        <ul>
          {suggestion.enables.map((suggestion2, i) => {
            return (
              <li key={suggestion2}>
                <EventSdkUpdateSuggestion suggestion={suggestion2} />
              </li>
            );
          })}
        </ul>
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
      <div>
        {data.map(suggestion => {
          return (
            <div className="alert-block alert-info box row" key={suggestion}>
              We recommend to <EventSdkUpdateSuggestion suggestion={suggestion} />
            </div>
          );
        })}
      </div>
    );
  }
}

export default EventSdkUpdates;
