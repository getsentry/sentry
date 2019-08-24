import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import DetailedError from 'app/components/errors/detailedError';

const GroupEventDetailsLoadingError = ({onRetry, environments}) => {
  const reasons = [
    t('The events are still processing and are on their way'),
    t('The events have been deleted'),
    t('There is an internal systems error or active issue'),
  ];

  let message;

  if (environments.length === 0) {
    // All Environments case
    message = (
      <div>
        <p>{t('This could be due to a handful of reasons:')}</p>
        <ol className="detailed-error-list">
          {reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ol>
      </div>
    );
  } else {
    message = (
      <div>{t('No events were found for the currently selected environments')}</div>
    );
  }

  return (
    <DetailedError
      className="group-event-details-error"
      onRetry={environments.length === 0 ? onRetry : null}
      heading={t('Sorry, the events for this issue could not be found.')}
      message={message}
    />
  );
};

GroupEventDetailsLoadingError.propTypes = {
  onRetry: PropTypes.func,
  environments: PropTypes.arrayOf(SentryTypes.Environment).isRequired,
};

export default GroupEventDetailsLoadingError;
