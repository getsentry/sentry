import React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DEFAULT_WIDGETS} from 'sentry/views/dashboardsV2/widgetLibrary/data';

import {Card} from './card';

export function WidgetLibrary({onWidgetSelect}) {
  const theme = useTheme();

  return (
    <React.Fragment>
      <h5>{t('Widget Library')}</h5>
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

const WidgetLibraryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
