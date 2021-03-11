import React from 'react';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';

import Count from 'app/components/count';
import Tooltip from 'app/components/tooltip';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

import {DisplayOption} from './utils';

type Props = {
  displayOption: DisplayOption;
  theme: Theme;
  children: React.ReactNode;
  releaseCount?: number | null;
  projectCount?: number | null;
};

function AdoptionTooltip({
  displayOption,
  theme,
  children,
  releaseCount,
  projectCount,
}: Props) {
  function displayLabel(count?: number | null) {
    if (displayOption === DisplayOption.USERS) {
      return tn('user', 'users', count);
    }

    return tn('session', 'sessions', count);
  }

  return (
    <Tooltip
      containerDisplayMode="block"
      popperStyle={{
        background: theme.gray500,
        maxWidth: '300px',
      }}
      title={
        <Wrapper>
          <Row>
            <Title>
              <Dot color={theme.progressBar} />
              {t('This Release')}
            </Title>
            <Value>
              <Count value={releaseCount ?? 0} /> {displayLabel(releaseCount)}
            </Value>
          </Row>
          <Row>
            <Title>
              <Dot color={theme.progressBackground} />
              {t('Total Project')}
            </Title>
            <Value>
              <Count value={projectCount ?? 0} /> {displayLabel(projectCount)}
            </Value>
          </Row>

          <Divider />

          <Time>{t('Last 24 hours')}</Time>
        </Wrapper>
      }
    >
      {children}
    </Tooltip>
  );
}

const Wrapper = styled('div')`
  padding: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 21px;
  font-weight: normal;
`;
const Row = styled('div')`
  display: grid;
  grid-template-columns: auto auto;
  grid-gap: ${space(3)};
  justify-content: space-between;
  padding-bottom: ${space(0.25)};
`;
const Title = styled('div')`
  text-align: left;
`;
const Dot = styled('div')<{color: string}>`
  display: inline-block;
  margin-right: ${space(0.75)};
  border-radius: 10px;
  width: 10px;
  height: 10px;
  background-color: ${p => p.color};
`;
const Value = styled('div')`
  color: ${p => p.theme.gray300};
  text-align: right;
`;
const Divider = styled('div')`
  border-top: 1px solid ${p => p.theme.gray400};
  margin: ${space(0.75)} -${space(2)} ${space(1)};
`;
const Time = styled('div')`
  color: ${p => p.theme.gray300};
  text-align: center;
`;

export default withTheme(AdoptionTooltip);
