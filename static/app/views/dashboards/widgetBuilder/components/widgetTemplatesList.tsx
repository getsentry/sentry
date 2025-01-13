import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getTopNConvertedDefaultWidgets} from 'sentry/views/dashboards/widgetLibrary/data';
import {getWidgetIcon} from 'sentry/views/dashboards/widgetLibrary/widgetCard';

function WidgetTemplatesList() {
  const organization = useOrganization();
  const [selectedWidget, setSelectedWidget] = useState<number | null>(null);

  const {dispatch} = useWidgetBuilderContext();

  const widgets = getTopNConvertedDefaultWidgets(organization);

  return (
    <Fragment>
      {widgets.map((widget, index) => {
        const iconColor = theme.charts.getColorPalette(widgets.length - 2)?.[index]!;

        const Icon = getWidgetIcon(widget.displayType);
        const lastWidget = index === widgets.length - 1;
        return (
          <TemplateContainer key={widget.id} lastWidget={lastWidget}>
            <TemplateCard
              selected={selectedWidget === index}
              onClick={() => {
                setSelectedWidget(index);
                dispatch({
                  type: BuilderStateAction.SET_STATE,
                  payload: convertWidgetToBuilderStateParams(widget),
                });
              }}
            >
              <IconWrapper backgroundColor={iconColor}>
                <Icon color="white" />
              </IconWrapper>
              <div>
                <WidgetTitle>{widget.title}</WidgetTitle>
                <WidgetDescription>{widget.description}</WidgetDescription>
                {selectedWidget === index && (
                  <ButtonsWrapper>
                    <Button size="sm">{t('Customize')}</Button>
                    <Button size="sm">{t('Add to dashboard')}</Button>
                  </ButtonsWrapper>
                )}
              </div>
            </TemplateCard>
          </TemplateContainer>
        );
      })}
    </Fragment>
  );
}

export default WidgetTemplatesList;

const TemplateContainer = styled('div')<{lastWidget: boolean}>`
  border-bottom: ${p => (p.lastWidget ? 'none' : `1px solid ${p.theme.border}`)};
`;

const TemplateCard = styled('div')<{selected: boolean}>`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
  padding: ${space(2)};
  border: none;
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => (p.selected ? p.theme.purple100 : p.theme.background)};
  margin: ${p => (p.selected ? space(2) : space(0.5))} 0px;

  cursor: pointer;

  &:focus,
  &:hover {
    background-color: ${p => p.theme.purple100};
    outline: none;
  }

  &:active {
    background-color: ${p => p.theme.purple100};
  }
`;

const WidgetTitle = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: ${space(0.25)};
`;

const WidgetDescription = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  margin-bottom: 0;
`;

const IconWrapper = styled('div')<{backgroundColor: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(1)};
  min-width: 40px;
  height: 40px;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.backgroundColor};
`;

const ButtonsWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(3)};
  margin-top: ${space(2)};
`;
