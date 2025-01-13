import {Fragment, useCallback, useState} from 'react';
import {useParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {Widget} from 'sentry/views/dashboards/types';
import {getTopNConvertedDefaultWidgets} from 'sentry/views/dashboards/widgetLibrary/data';
import {getWidgetIcon} from 'sentry/views/dashboards/widgetLibrary/widgetCard';

type WidgetTemplatesListProps = {
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
};

function WidgetTemplatesList({onSave}: WidgetTemplatesListProps) {
  const organization = useOrganization();
  const [selectedWidget, setSelectedWidget] = useState<number | null>(null);
  const {widgetIndex} = useParams();
  const api = useApi();

  const widgets = getTopNConvertedDefaultWidgets(organization);

  const handleSave = useCallback(
    async (widget: Widget) => {
      try {
        const newWidget = {...widget, id: undefined};
        await validateWidget(api, organization.slug, newWidget);
        onSave({index: Number(widgetIndex), widget: newWidget});
      } catch (error) {
        addErrorMessage(t('Unable to add widget'));
      }
    },
    [api, organization.slug, widgetIndex, onSave]
  );

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
              onClick={() => setSelectedWidget(index)}
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
                    <Button size="sm" onClick={() => handleSave(widget)}>
                      {t('Add to dashboard')}
                    </Button>
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
