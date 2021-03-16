import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';

import ProgressRing from 'app/components/progressRing';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OnboardingTaskDescriptor, OnboardingTaskStatus} from 'app/types';
import {Theme} from 'app/utils/theme';

type Props = {
  theme: Theme;
  allTasks: OnboardingTaskDescriptor[];
  completedTasks: OnboardingTaskStatus[];
};
const ProgressHeader = ({theme, allTasks, completedTasks}: Props) => (
  <Container>
    <StyledProgressRing
      size={80}
      barWidth={8}
      text={allTasks.length - completedTasks.length}
      animateText
      value={(completedTasks.length / allTasks.length) * 100}
      progressEndcaps="round"
      backgroundColor={theme.gray100}
      textCss={() => css`
        font-size: 26px;
        color: ${theme.textColor};
      `}
    />
    <HeaderTitle>{t('Quick Start')}</HeaderTitle>
    <Description>
      {t("Take full advantage of Sentry's powerful monitoring features.")}
    </Description>
  </Container>
);

export default withTheme(ProgressHeader);

const Container = styled('div')`
  display: grid;
  grid-template-columns: min-content 1fr;
  grid-template-rows: min-content 1fr;
  grid-column-gap: ${space(2)};
  margin: 90px ${space(4)} 0 ${space(4)};
`;

const StyledProgressRing = styled(ProgressRing)`
  grid-column: 1/2;
  grid-row: 1/3;
`;

const HeaderTitle = styled('h3')`
  margin: 0;
  grid-column: 2/3;
  grid-row: 1/2;
`;

const Description = styled('div')`
  color: ${p => p.theme.gray300};
  grid-column: 2/3;
  grid-row: 2/3;
`;
