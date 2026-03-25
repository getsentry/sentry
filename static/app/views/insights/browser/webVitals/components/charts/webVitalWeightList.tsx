import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import {t} from 'sentry/locale';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import {ORDER, type WebVitals} from 'sentry/views/insights/browser/webVitals/types';

interface WebVitalsWeightListProps {
  weights: Record<WebVitals, number>;
}
export function WebVitalsWeightList({weights}: WebVitalsWeightListProps) {
  const theme = useTheme();
  const segmentColors = theme.chart.getColorPalette(4);

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
  font-size: ${p => p.theme.font.size.sm};
`;

const List = styled('ul')`
  list-style-type: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')``;

const Dot = styled('span')<{color: string}>`
  display: inline-block;
  margin-right: ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  width: ${p => p.theme.space.md};
  height: ${p => p.theme.space.md};
  background-color: ${p => p.color};
`;
