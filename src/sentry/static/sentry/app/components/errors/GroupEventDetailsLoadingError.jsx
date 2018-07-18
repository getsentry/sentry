import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import DetailedError from 'app/components/errors/detailedError';

const GroupEventDetailsLoadingError = ({onRetry}) => {
  const reasons = [
    t('The events are still processing and are on their way'),
    t('The events have been deleted'),
    t('There is an internal systems error or active issue'),
  ];

  return (
    <DetailedError
      className="group-event-details-error"
      onRetry={onRetry}
      heading={t('Sorry, the events for this issue could not be found.')}
      message={
        <div>
          <p>{t('This could be due to a handful of reasons:')}</p>
          <ol className="detailed-error-list">
            {reasons.map((reason, i) => <li key={i}>{reason}</li>)}
          </ol>
        </div>
      }
    />
  );
};

GroupEventDetailsLoadingError.propTypes = {
  onRetry: PropTypes.func,
};

export default GroupEventDetailsLoadingError;
