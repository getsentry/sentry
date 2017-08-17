import React, {PropTypes} from 'react';
import classNames from 'classnames';

import {t} from '../locale';
import SpreadLayout from './spreadLayout';

import '../../less/components/similarScoreCard.less';

// TODO(billy): Replace this with a quantified aggregate score
const scoreComponents = {
  'exception:message:character-shingles': t('Exception Message'),
  'exception:stacktrace:application-chunks': t('Application Code'),
  'exception:stacktrace:pairs': t('Stacktrace Frames'),
  'message:message:character-shingles': t('Log Message')
};

// classnames that map to colors to css
const scoreClassNames = ['low', 'low', 'low', 'med', 'high', 'high'];

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
          <SpreadLayout key={key}>
            <div>
              {scoreComponents[key]}
            </div>

            <div
              className={classNames(
                'similar-score-quantity',
                scoreClassNames[Math.round(score * 5)]
              )}
            />
          </SpreadLayout>
        ))}
      </div>
    );
  }
});

export default SimilarScoreCard;
