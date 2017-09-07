import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import '../../less/components/scoreBar.less';

const ScoreBar = React.createClass({
  propTypes: {
    vertical: PropTypes.bool,
    score: PropTypes.number.isRequired,
    /** Array of strings */
    palette: PropTypes.arrayOf(PropTypes.string),
    /** Array of classNames whose index maps to score */
    paletteClassNames: PropTypes.arrayOf(PropTypes.string),
    /** Default controlled by CSS */
    size: PropTypes.number,
    thickness: PropTypes.number
  },

  getDefaultProps() {
    return {
      palette: [],
      paletteClassNames: ['low', 'low-med', 'med', 'med-high', 'high']
    };
  },

  getInitialState() {
    return {};
  },

  render() {
    let {
      className,
      vertical,
      palette,
      paletteClassNames,
      score,
      size,
      thickness
    } = this.props;
    let useCss = !!paletteClassNames.length && !palette.length;
    let maxScore = useCss ? paletteClassNames.length : palette.length;
    let cx = classNames('score-bar', className, {
      vertical,
      horizontal: !vertical
    });

    // Make sure score is between 0 and maxScore
    let scoreInBounds = score >= maxScore ? maxScore : score <= 0 ? 0 : score;
    // Make sure paletteIndex is 0 based
    let paletteIndex = scoreInBounds - 1;

    // Size of bar, depends on orientation, although we could just apply a transformation via css
    let sizeStyle = {
      [vertical ? 'width' : 'height']: size,
      [vertical ? 'height' : 'width']: thickness
    };

    let style = {
      ...sizeStyle,
      ...(!useCss
        ? {
            backgroundColor: palette[paletteIndex]
          }
        : {})
    };

    return (
      <div className={cx}>
        {[...Array(scoreInBounds)].map((j, i) => {
          let paletteClassName = (useCss && paletteClassNames[paletteIndex]) || '';
          let barCx = classNames('score-bar-bar', {
            [paletteClassName]: !!paletteClassName
          });
          return <div key={i} style={style} className={barCx} />;
        })}
        {[...Array(maxScore - scoreInBounds)].map((j, i) => (
          <div
            style={{...sizeStyle}}
            key={`empty-${i}`}
            className="score-bar-bar empty"
          />
        ))}
      </div>
    );
  }
});

export default ScoreBar;
