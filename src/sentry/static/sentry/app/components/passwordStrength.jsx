import {throttle} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import zxcvbn from 'zxcvbn';
import styled, {css} from 'react-emotion';
import {tct} from 'app/locale';

import theme from 'app/utils/theme';

/**
 * NOTE: Do not import this component synchronously. The zxcvbn library is
 * relatively large. This component should be loaded async as a split chunk.
 */

/**
 * The maximum score that zxcvbn reports
 */
const MAX_SCORE = 5;

class PasswordStrength extends React.Component {
  static propTypes = {
    /**
     * A set of labels to display for each password strength level. 5 levels.
     */
    labels: PropTypes.arrayOf(PropTypes.string),
    /**
     * The color to make the progress bar for each strength level. 5 levels.
     */
    colors: PropTypes.arrayOf(PropTypes.string),
    /**
     * The password value.
     */
    value: PropTypes.string,
  };

  static defaultProps = {
    labels: ['Very Weak', 'Very Weak', 'Weak', 'Strong', 'Very Strong'],
    colors: [theme.red, theme.red, theme.yellow, theme.green, theme.green],
  };

  render() {
    const {value, labels, colors} = this.props;
    if (value === '') {
      return null;
    }

    const result = zxcvbn(value);
    if (!result) {
      return null;
    }

    const {score} = result;
    const percent = Math.round((score + 1) / MAX_SCORE * 100);

    const styles = css`
      background: ${colors[score]};
      width: ${percent}%;
      height: 100%;
    `;

    return (
      <React.Fragment>
        <StrengthProgress
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div css={styles} />
        </StrengthProgress>
        <StrengthLabel>
          {tct('Strength: [textScore]', {
            textScore: <ScoreText>{labels[score]}</ScoreText>,
          })}
        </StrengthLabel>
      </React.Fragment>
    );
  }
}

const StrengthProgress = styled('div')`
  background: ${theme.offWhite2};
  height: 8px;
  border-radius: 2px;
  overflow: hidden;
`;

const StrengthLabel = styled('div')`
  font-size: 0.8em;
  margin-top: 2px;
  color: ${theme.gray3};
`;

const ScoreText = styled('strong')`
  color: #000;
`;

export default PasswordStrength;

/**
 * This is a shim that allows the password strength component to be used
 * outside of our main react application. Mostly useful since all of our
 * registration pages aren't in the react app.
 */
export const attachTo = ({input, element}) =>
  element &&
  input &&
  input.addEventListener(
    'input',
    throttle(e => {
      ReactDOM.render(<PasswordStrength value={e.target.value} />, element);
    })
  );
