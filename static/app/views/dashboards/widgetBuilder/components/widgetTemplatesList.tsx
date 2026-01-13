import {Fragment, useCallback, useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
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
  setCustomizeFromLibrary: (customizeFromLibrary: boolean) => void;
  setIsPreviewDraggable: (isPreviewDraggable: boolean) => void;
  setOpenWidgetTemplates: (openWidgetTemplates: boolean) => void;
}

function WidgetTemplatesList({
  onSave,
  setOpenWidgetTemplates,
  setIsPreviewDraggable,
  setCustomizeFromLibrary,
}: WidgetTemplatesListProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const [selectedWidget, setSelectedWidget] = useState<number | null>(0);

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
        const iconColor = theme.chart.getColorPalette(widgets.length - 1)?.[index]!;

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
              <IconWrapper backgroundColor={iconColor}>{Icon}</IconWrapper>
              <div>
                <WidgetTitle>{widget.title}</WidgetTitle>
                <WidgetDescription>{widget.description}</WidgetDescription>
                {selectedWidget === index && (
                  <Flex marginTop="xl" gap="2xl">
                    <Button
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        setOpenWidgetTemplates(false);
                        setCustomizeFromLibrary(true);
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
                  </Flex>
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
  border-bottom: ${p =>
    p.lastWidget ? 'none' : `1px solid ${p.theme.tokens.border.primary}`};
`;

const TemplateCard = styled('div')<{selected: boolean}>`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
  padding: ${space(2)};
  border: none;
  background-color: ${p =>
    p.selected
      ? p.theme.tokens.background.transparent.accent.muted
      : p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  margin: ${p => (p.selected ? space(2) : space(0.5))} 0px;

  cursor: pointer;

  &:focus,
  &:hover {
    background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
    outline: none;
  }

  &:active {
    background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
  }
`;

const WidgetTitle = styled('h3')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-bottom: ${space(0.25)};
`;

const WidgetDescription = styled('p')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.secondary};
  margin-bottom: 0;
`;

const IconWrapper = styled('div')<{backgroundColor: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(1)};
  min-width: 40px;
  height: 40px;
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.backgroundColor};
`;
