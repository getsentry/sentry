import React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openWidgetBuilderOverwriteModal} from 'sentry/actionCreators/modal';
import {OverwriteWidgetModalProps} from 'sentry/components/modals/widgetBuilder/overwriteWidgetModal';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DisplayType} from 'sentry/views/dashboardsV2/types';
import {
  DEFAULT_WIDGETS,
  WidgetTemplate,
} from 'sentry/views/dashboardsV2/widgetLibrary/data';

import {normalizeQueries} from '../utils';

import {Card} from './card';

interface Props {
  bypassOverwriteModal: boolean;
  onWidgetSelect: (widget: WidgetTemplate) => void;
  widgetBuilderNewDesign: boolean;
}

export function WidgetLibrary({
  bypassOverwriteModal,
  onWidgetSelect,
  widgetBuilderNewDesign,
}: Props) {
  const theme = useTheme();

  function getLibrarySelectionHandler(
    widget: OverwriteWidgetModalProps['widget'],
    iconColor: OverwriteWidgetModalProps['iconColor']
  ) {
    return function handleWidgetSelect() {
      if (bypassOverwriteModal) {
        onWidgetSelect(widget);
        return;
      }

      openWidgetBuilderOverwriteModal({
        onConfirm: () => onWidgetSelect(widget),
        widget,
        iconColor,
      });
    };
  }

  return (
    <React.Fragment>
      <Header>{t('Widget Library')}</Header>
      <WidgetLibraryWrapper>
        {DEFAULT_WIDGETS.map((widget, index) => {
          const iconColor = theme.charts.getColorPalette(DEFAULT_WIDGETS.length - 2)[
            index
          ];

          const displayType =
            widgetBuilderNewDesign && widget.displayType === DisplayType.TOP_N
              ? DisplayType.TABLE
              : widget.displayType;

          const normalizedQueries = normalizeQueries({
            displayType,
            queries: widget.queries,
            widgetBuilderNewDesign,
            widgetType: widget.widgetType,
          });

          const newWidget = {
            ...widget,
            displayType,
            queries: normalizedQueries,
          };

          return (
            <CardHoverWrapper
              key={widget.title}
              onClick={getLibrarySelectionHandler(newWidget, iconColor)}
            >
              <Card widget={newWidget} iconColor={iconColor} />
            </CardHoverWrapper>
          );
        })}
      </WidgetLibraryWrapper>
    </React.Fragment>
  );
}

const WidgetLibraryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Header = styled('h5')`
  /* to be aligned with the 30px of Layout.main padding */
  padding-left: calc(${space(2)} - ${space(0.25)});
`;

const CardHoverWrapper = styled('div')`
  /* to be aligned with the 30px of Layout.main padding - 1px of the widget item border */
  padding: calc(${space(2)} - 3px);
  border: 1px solid transparent;
  border-radius: ${p => p.theme.borderRadius};
  transition: border-color 0.3s ease;
  cursor: pointer;
  &:hover {
    border-color: ${p => p.theme.gray100};
  }
`;
