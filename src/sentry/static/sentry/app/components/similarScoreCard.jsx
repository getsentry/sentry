import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import {t} from '../locale';
import SpreadLayout from './spreadLayout';

import '../../less/components/similarScoreCard.less';

const scoreComponents = {
  'exception:message:character-shingles': t('Exception Message'),
  'exception:stacktrace:application-chunks': t('Application Code'),
  'exception:stacktrace:pairs': t('Stacktrace Frames'),
  'message:message:character-shingles': t('Log Message')
};

// classnames that map to colors to css
const scoreClassNames = ['low', 'low', 'low-med', 'med', 'med-high', 'high'];

const SimilarScoreCard = React.createClass({
  propTypes: {
    scoreList: PropTypes.arrayOf(PropTypes.array)
  },

  getDefaultProps() {
    return {
      scoreList: []
    };
  },

  render() {
    let {className, scoreList} = this.props;
    let cx = classNames('similar-score-card', className);

    if (!scoreList.length) {
      return null;
    }

    return (
      <div className={cx}>
        {scoreList.map(([key, score]) => (
          <SpreadLayout className="similar-score-card-row" key={key}>
            <div>
              {scoreComponents[key]}
            </div>

            <div
              className={classNames(
                'similar-score-quantity',
                score === null ? 'empty' : scoreClassNames[Math.round(score * 5)]
              )}
            />
          </SpreadLayout>
        ))}
      </div>
    );
  }
});

export default SimilarScoreCard;
