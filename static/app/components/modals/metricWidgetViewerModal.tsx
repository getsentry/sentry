import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Input from 'sentry/components/deprecatedforms/input';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {WidgetViewerModalOptions} from 'sentry/components/modals/widgetViewerModal';
import {
  IconCheckmark,
  IconEdit,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MRI, Organization, PageFilters} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDdmUrl, isCustomMetric, stringifyMetricWidget} from 'sentry/utils/metrics';
import type {MetricsQuery,MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import withPageFilters from 'sentry/utils/withPageFilters';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetDescription} from 'sentry/views/dashboards/widgetCard';
import {getCreateAlert} from 'sentry/views/ddm/contextMenu';
import {Query} from 'sentry/views/ddm/queries';
import {MetricDetails} from 'sentry/views/ddm/widgetDetails';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {
  convertToDashboardWidget,
  toMetricDisplayType,
} from '../../utils/metrics/dashboard';
import {parseField} from '../../utils/metrics/mri';
import {MetricWidget} from '../../views/ddm/widget';
import {Tooltip} from '../tooltip';

interface Props extends ModalRenderProps, WidgetViewerModalOptions {
  organization: Organization;
  selection: PageFilters;
}

function convertFromWidget(widget: Widget): MetricWidgetQueryParams {
  const query = widget.queries[0];
  const parsed = parseField(query.aggregates[0]) || {mri: '' as MRI, op: ''};

  return {
    mri: parsed.mri,
    op: parsed.op,
    query: query.conditions,
    groupBy: query.columns,
    displayType: toMetricDisplayType(widget.displayType),
  };
}

function MetricWidgetViewerModal(props: Props) {

  const {organization, widget, Footer, Body, Header, closeModal, selection, onMetricWidgetEdit} = props;

  const router = useRouter();

  const [metricWidgetQueryParams, setMetricWidgetQueryParams] =
    useState<MetricWidgetQueryParams>(convertFromWidget(widget));

  const defaultTitle = useMemo(
    () => stringifyMetricWidget(metricWidgetQueryParams),
    [metricWidgetQueryParams]
  );

  const [title, setTitle] = useState<string>(widget.title ?? defaultTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const handleChange = useCallback(
    (data: Partial<MetricWidgetQueryParams>) => {
      setMetricWidgetQueryParams(curr => ({
        ...curr,
        ...data,
      }));
    },
    [setMetricWidgetQueryParams]
  );

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      {...selection, ...metricWidgetQueryParams},
      toMetricDisplayType(metricWidgetQueryParams.displayType)
    );

    const isCustomTitle = title !== '' && title !== defaultTitle;

    const updatedWidget = {
      ...widget,
      // If user renamed the widget, preserve that title, otherwise stringify the widget query params
      title: isCustomTitle ? title : defaultTitle,
      queries: convertedWidget.queries,
      displayType: convertedWidget.displayType,
    };

    onMetricWidgetEdit?.(updatedWidget);
  }, [title, defaultTitle, metricWidgetQueryParams, onMetricWidgetEdit, widget, selection]);


  return (
    <Fragment>
      <OrganizationContext.Provider value={organization}>
        <Header closeButton>
          <WidgetHeader>
            {/* { TODO: extract to a separate component in a followup } */}
            <WidgetTitleRow>
              {isEditingTitle ? (
                <Input
                  value={title}
                  placeholder={stringifyMetricWidget(metricWidgetQueryParams)}
                  onChange={e => {
                    setTitle?.(e.target.value ?? defaultTitle);
                  }}
                />
              ) : (
                <h3>{title}</h3>
              )}
              <Button
                aria-label="Edit Title"
                size="sm"
                borderless
                icon={
                  isEditingTitle ? <IconCheckmark size="sm" /> : <IconEdit size="sm" />
                }
                priority={isEditingTitle ? 'primary' : 'default'}
                onClick={() => {
                  setIsEditingTitle(curr => !curr);
                }}
              />
            </WidgetTitleRow>
            {widget.description && (
              <Tooltip
                title={widget.description}
                containerDisplayMode="grid"
                showOnlyOnOverflow
                isHoverable
                position="bottom"
              >
                <WidgetDescription>{widget.description}</WidgetDescription>
              </Tooltip>
            )}
          </WidgetHeader>
        </Header>
        <Body>
          <Query
            widget={metricWidgetQueryParams}
            projects={selection.projects}
            onChange={handleChange}
            contextMenu={
              <ContextMenu
                metricsQuery={{
                  mri: metricWidgetQueryParams.mri,
                  query: metricWidgetQueryParams.query,
                  op: metricWidgetQueryParams.op,
                  groupBy: metricWidgetQueryParams.groupBy,
                  projects: selection.projects,
                  datetime: selection.datetime,
                  environments: selection.environments,
                }}
              />
            }
          />
          <MetricWidget
            widget={metricWidgetQueryParams}
            onChange={(_, data) => {
              handleChange(data);
            }}
            datetime={selection.datetime}
            projects={selection.projects}
            environments={selection.environments}
          />
          <MetricDetails widget={metricWidgetQueryParams} />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button
              onClick={() => {
                closeModal();
                router.push(
                  getDdmUrl(organization.slug, {
                    widgets: [metricWidgetQueryParams],
                    project: selection.projects,
                    ...selection.datetime,
                    environment: selection.environments,
                  })
                );
              }}
            >
              {t('Open in Metrics')}
            </Button>
            <Button
              onClick={() => {
                closeModal();
              }}
            >
              {t('Close')}
            </Button>
            <Button
              color="primary"
              priority="primary"
              onClick={() => {
                handleSubmit();
                closeModal();
              }}
            >
              {t('Save changes')}
            </Button>
          </ButtonBar>
        </Footer>
      </OrganizationContext.Provider>
    </Fragment>
  );
}
export function ContextMenu({
  metricsQuery,
}: {
  metricsQuery: MetricsQuery;
}) {
  const organization = useOrganization();
  const router = useRouter();

  const createAlert = useMemo(
    () => getCreateAlert(organization, metricsQuery),
    [metricsQuery, organization]
  );

  const items = useMemo<MenuItemProps[]>(() => {
    const customMetric = !isCustomMetric({mri: metricsQuery.mri});
    const addAlertItem = {
      leadingItems: [<IconSiren key="icon" />],
      key: 'add-alert',
      label: t('Create Alert'),
      disabled: !createAlert,
      onAction: () => {
        trackAnalytics('ddm.create-alert', {
          organization,
          source: 'widget',
        });
        Sentry.metrics.increment('ddm.dashboards.widget.alert');
        createAlert?.();
      },
    };
    const settingsItem = {
      leadingItems: [<IconSettings key="icon" />],
      key: 'settings',
      label: t('Metric Settings'),
      disabled: !customMetric,
      onAction: () => {
        trackAnalytics('ddm.widget.settings', {
          organization,
        });
        Sentry.metrics.increment('ddm.dashboards.widget.settings');
        navigateTo(
          `/settings/projects/:projectId/metrics/${encodeURIComponent(metricsQuery.mri)}`,
          router
        );
      },
    };

    return customMetric ? [addAlertItem, settingsItem] : [addAlertItem];
  }, [createAlert, metricsQuery.mri, organization, router]);

  return (
    <DropdownMenu
      items={items}
      triggerProps={{
        'aria-label': t('Widget actions'),
        size: 'md',
        showChevron: false,
        icon: <IconEllipsis direction="down" size="sm" />,
      }}
      position="bottom-end"
    />
  );
}

export default withPageFilters(MetricWidgetViewerModal);

const WidgetHeader = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const WidgetTitleRow = styled('div')`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: ${space(1)};
`;

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;
