import React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {OverwriteWidgetModalProps} from 'sentry/components/modals/widgetBuilder/overwriteWidgetModal';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  DEFAULT_WIDGETS,
  WidgetTemplate,
} from 'sentry/views/dashboardsV2/widgetLibrary/data';

import {Card} from './card';

type Props = {
  onWidgetSelect: (widget: WidgetTemplate) => void;
};

export async function openWidgetBuilderOverwriteModal(
  options: OverwriteWidgetModalProps
) {
  const mod = await import('sentry/components/modals/widgetBuilder/overwriteWidgetModal');
  const {default: Modal, modalCss} = mod;

  openModal(deps => <Modal {...deps} {...options} />, {backdrop: 'static', modalCss});
}

export function WidgetLibrary({onWidgetSelect}: Props) {
  const theme = useTheme();

  function getLibrarySelectionHandler(widget, iconColor) {
    return function handleWidgetSelect() {
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
          return (
            <CardHoverWrapper
              key={widget.title}
              onClick={getLibrarySelectionHandler(widget, iconColor)}
            >
              <Card widget={widget} iconColor={iconColor} />
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
  margin-left: ${space(2)};
`;

const CardHoverWrapper = styled('div')`
  padding: calc(${space(2)} - 1px);
  border: 1px solid transparent;
  border-radius: ${p => p.theme.borderRadius};
  transition: border-color 0.3s ease;
  cursor: pointer;
  &:hover {
    border-color: ${p => p.theme.gray100};
  }
`;
