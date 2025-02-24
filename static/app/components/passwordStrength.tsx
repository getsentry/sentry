import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'zxcv... Remove this comment to see the full error message
import zxcvbn from 'zxcvbn';

import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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

/**
 * NOTE: Do not import this component synchronously. The zxcvbn library is
 * relatively large. This component should be loaded async as a split chunk.
 */
export function PasswordStrength(props: Props) {
  const theme = useTheme();
  const colors = props.colors ?? [
    theme.red300,
    theme.red300,
    theme.yellow300,
    theme.green300,
    theme.green300,
  ];
  const labels = props.labels ?? [
    'Very Weak',
    'Very Weak',
    'Weak',
    'Strong',
    'Very Strong',
  ];

  if (props.value === '') {
    return null;
  }

  const result = zxcvbn(props.value);

  if (!result) {
    return null;
  }

  const percent = Math.round(((result.score + 1) / MAX_SCORE) * 100);

  const styles = css`
    background: ${colors[result.score]};
    width: ${percent}%;
  `;

  return (
    <Fragment>
      <StrengthProgress
        role="progressbar"
        aria-valuenow={result.score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <StrengthProgressBar css={styles} />
      </StrengthProgress>
      <StrengthLabel>
        {tct('Strength: [textScore]', {
          textScore: <ScoreText>{labels[result.score]}</ScoreText>,
        })}
      </StrengthLabel>
    </Fragment>
  );
}

const StrengthProgress = styled('div')`
  background: ${p => p.theme.gray200};
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
  color: ${p => p.theme.gray400};
`;

const ScoreText = styled('strong')`
  color: ${p => p.theme.black};
`;
