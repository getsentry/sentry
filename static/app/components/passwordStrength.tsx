import {Fragment} from 'react';
import {render} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import throttle from 'lodash/throttle';
import zxcvbn from 'zxcvbn';

import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

/**
 * NOTE: Do not import this component synchronously. The zxcvbn library is
 * relatively large. This component should be loaded async as a split chunk.
 */

/**
 * The maximum score that zxcvbn reports
 */
const MAX_SCORE = 5;

type Props = {
  /**
   * The password value.
   */
  value: string;
  /**
   * The color to make the progress bar for each strength level. 5 levels.
   */
  colors?: [string, string, string, string, string];
  /**
   * A set of labels to display for each password strength level. 5 levels.
   */
  labels?: [string, string, string, string, string];
};

const PasswordStrength = ({
  value,
  labels = ['Very Weak', 'Very Weak', 'Weak', 'Strong', 'Very Strong'],
  colors = [theme.red300, theme.red300, theme.yellow300, theme.green300, theme.green300],
}: Props) => {
  if (value === '') {
    return null;
  }

  const result = zxcvbn(value);

  if (!result) {
    return null;
  }

  const {score} = result;
  const percent = Math.round(((score + 1) / MAX_SCORE) * 100);

  const styles = css`
    background: ${colors[score]};
    width: ${percent}%;
  `;

  return (
    <Fragment>
      <StrengthProgress
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <StrengthProgressBar css={styles} />
      </StrengthProgress>
      <StrengthLabel>
        {tct('Strength: [textScore]', {
          textScore: <ScoreText>{labels[score]}</ScoreText>,
        })}
      </StrengthLabel>
    </Fragment>
  );
};

const StrengthProgress = styled('div')`
  background: ${theme.gray200};
  height: 8px;
  border-radius: 2px;
  overflow: hidden;
`;

const StrengthProgressBar = styled('div')`
  height: 100%;
`;

const StrengthLabel = styled('div')`
  font-size: 0.8em;
  margin-top: ${space(0.25)};
  color: ${theme.gray400};
`;

const ScoreText = styled('strong')`
  color: ${p => p.theme.black};
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
      render(<PasswordStrength value={e.target.value} />, element);
    })
  );
