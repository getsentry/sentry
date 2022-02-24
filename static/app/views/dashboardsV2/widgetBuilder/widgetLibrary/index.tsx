import React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {DEFAULT_WIDGETS} from '../../widgetLibrary/data';

import {Card} from './card';

export function WidgetLibrary({onWidgetSelect}) {
  const theme = useTheme();

  return (
    <React.Fragment>
      <Heading>{t('Widget Library')}</Heading>
      <WidgetLibraryWrapper>
        {DEFAULT_WIDGETS.map((widget, index) => (
          <Card
            key={widget.title}
            widget={widget}
            iconColor={theme.charts.getColorPalette(DEFAULT_WIDGETS.length - 2)[index]}
            onClick={() => onWidgetSelect(widget)}
          />
        ))}
      </WidgetLibraryWrapper>
    </React.Fragment>
  );
}

const Heading = styled('h5')`
  font-weight: 500;
  color: ${p => p.theme.gray500};
`;

const WidgetLibraryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
