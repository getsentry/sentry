import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import ProgressRing from 'app/components/progressRing';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OnboardingTaskDescriptor, OnboardingTaskStatus} from 'app/types';
import theme from 'app/utils/theme';

type Props = {
  allTasks: OnboardingTaskDescriptor[];
  completedTasks: OnboardingTaskStatus[];
};
const ProgressHeader = ({allTasks, completedTasks}: Props) => (
  <Container>
    <ProgressRing
      size={88}
      barWidth={12}
      text={allTasks.length - completedTasks.length}
      animateText
      value={(completedTasks.length / allTasks.length) * 100}
      progressEndcaps="round"
      backgroundColor={theme.gray200}
      textCss={() => css`
        font-size: 26px;
        color: ${theme.gray300};
      `}
    />
    <HeadingText>
      <h4>{t('Setup Sentry')}</h4>
      <p>{t('Complete these tasks to take full advantage of Sentry in your project')}</p>
    </HeadingText>
  </Container>
);

export default ProgressHeader;

const Container = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(2)};
  padding: ${space(4)};
  align-items: center;
`;

const HeadingText = styled('div')`
  h4 {
    font-weight: normal;
    margin-bottom: ${space(1)};
  }

  p {
    color: ${p => p.theme.gray300};
    margin: 0;
    line-height: 2rem;
  }
`;
