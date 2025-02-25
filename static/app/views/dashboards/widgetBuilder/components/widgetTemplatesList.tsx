import {Fragment, useCallback, useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {getChartColorPalette} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {Widget} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getTopNConvertedDefaultWidgets} from 'sentry/views/dashboards/widgetLibrary/data';
import {getWidgetIcon} from 'sentry/views/dashboards/widgetLibrary/widgetCard';

interface WidgetTemplatesListProps {
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
  setIsPreviewDraggable: (isPreviewDraggable: boolean) => void;
  setOpenWidgetTemplates: (openWidgetTemplates: boolean) => void;
}

function WidgetTemplatesList({
  onSave,
  setOpenWidgetTemplates,
  setIsPreviewDraggable,
}: WidgetTemplatesListProps) {
  const organization = useOrganization();
  const [selectedWidget, setSelectedWidget] = useState<number | null>(null);

  const {dispatch} = useWidgetBuilderContext();
  const {widgetIndex} = useParams();
  const api = useApi();

  useEffect(() => {
    trackAnalytics('dashboards_views.widget_builder.templates.open', {
      organization,
    });
    // We only want to track this once when the component is mounted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        const iconColor = getChartColorPalette(widgets.length - 2)?.[index]!;

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
                trackAnalytics('dashboards_views.widget_builder.templates.selected', {
                  title: widget.title,
                  widget_type: widget.widgetType ?? '',
                  organization,
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
                    <Button
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        setOpenWidgetTemplates(false);
                        // reset preview when customizing templates
                        setIsPreviewDraggable(false);
                        trackAnalytics(
                          'dashboards_views.widget_builder.templates.customize',
                          {
                            title: widget.title,
                            widget_type: widget.widgetType ?? '',
                            organization,
                          }
                        );
                      }}
                    >
                      {t('Customize')}
                    </Button>
                    <Button
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        handleSave(widget);
                        trackAnalytics(
                          'dashboards_views.widget_builder.templates.add_to_dashboard',
                          {
                            title: widget.title,
                            widget_type: widget.widgetType ?? '',
                            organization,
                          }
                        );
                      }}
                    >
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
