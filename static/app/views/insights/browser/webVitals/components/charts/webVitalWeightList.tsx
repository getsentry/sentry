import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';

import {MODULE_DOC_LINK} from '../../settings';
import type {WebVitals} from '../../types';
import {Dot} from '../webVitalMeters';

import {ORDER} from './performanceScoreChart';

interface WebVitalsWeightListProps {
  weights: Record<WebVitals, number>;
}
export function WebVitalsWeightList({weights}: WebVitalsWeightListProps) {
  const theme = useTheme();
  const segmentColors = theme.chart.getColorPalette(3);

  return (
    <Content>
      <p>
        {t('Each Web Vital score contributes a different amount to the total score.')}
        <ExternalLink href={`${MODULE_DOC_LINK}#performance-score`}>
          {' '}
          {t('How is this calculated?')}
        </ExternalLink>
      </p>

      <List>
        {ORDER.map((webVital, index) => (
          <ListItem key={webVital}>
            <Dot color={segmentColors[index]!} />
            {t('%s contributes %s%%', webVital.toUpperCase(), weights[webVital])}
          </ListItem>
        ))}
      </List>
    </Content>
  );
}

const Content = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const List = styled('ul')`
  list-style-type: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')``;
