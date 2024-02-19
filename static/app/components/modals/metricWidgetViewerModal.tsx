import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Input from 'sentry/components/input';
import type {WidgetViewerModalOptions} from 'sentry/components/modals/widgetViewerModal';
import {
  IconCheckmark,
  IconEdit,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {
  getDdmUrl,
  getFormattedMQL,
  isCustomMetric,
  isFormattedMQL,
} from 'sentry/utils/metrics';
import type {MetricsQuery, MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {WidgetDescription} from 'sentry/views/dashboards/widgetCard';
import {getCreateAlert} from 'sentry/views/ddm/contextMenu';
import {Query} from 'sentry/views/ddm/queries';
import {MetricDetails} from 'sentry/views/ddm/widgetDetails';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {
  convertToDashboardWidget,
  convertToMetricWidget,
  toMetricDisplayType,
} from '../../utils/metrics/dashboard';
import {MetricWidget} from '../../views/ddm/widget';
import {Tooltip} from '../tooltip';

interface Props extends ModalRenderProps, WidgetViewerModalOptions {
  organization: Organization;
}

function MetricWidgetViewerModal({
  organization,
  widget,
  Footer,
  Body,
  Header,
  closeModal,
  onMetricWidgetEdit,
}: Props) {
  const {selection} = usePageFilters();
  const [metricWidgetQueryParams, setMetricWidgetQueryParams] =
    useState<MetricWidgetQueryParams>(convertToMetricWidget(widget));

  const widgetMQL = useMemo(
    () => getFormattedMQL(metricWidgetQueryParams),
    [metricWidgetQueryParams]
  );

  const [editedTitle, setEditedTitle] = useState<string>(widget.title || widgetMQL);
  const isMQLTitle = useMemo(() => isFormattedMQL(editedTitle), [editedTitle]);
  // If user renamed the widget, dislay that title, otherwise display the MQL
  const titleToDisplay = isMQLTitle ? widgetMQL : editedTitle;

  const handleChange = useCallback(
    (data: Partial<MetricWidgetQueryParams>) => {
      setMetricWidgetQueryParams(curr => ({
        ...curr,
        ...data,
      }));
    },
    [setMetricWidgetQueryParams]
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      setEditedTitle(value || widgetMQL);
    },
    [setEditedTitle, widgetMQL]
  );

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      {...selection, ...metricWidgetQueryParams},
      toMetricDisplayType(metricWidgetQueryParams.displayType)
    );

    const updatedWidget = {
      ...widget,
      title: titleToDisplay,
      queries: convertedWidget.queries,
      displayType: convertedWidget.displayType,
    };

    onMetricWidgetEdit?.(updatedWidget);

    closeModal();
  }, [
    titleToDisplay,
    metricWidgetQueryParams,
    onMetricWidgetEdit,
    closeModal,
    widget,
    selection,
  ]);

  return (
    <Fragment>
      <OrganizationContext.Provider value={organization}>
        <Header closeButton>
          <WidgetHeader>
            <WidgetTitle
              value={editedTitle}
              displayValue={titleToDisplay}
              placeholder={widgetMQL}
              onSubmit={handleTitleChange}
            />
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
            queries={[
              {
                mri: metricWidgetQueryParams.mri,
                query: metricWidgetQueryParams.query,
                op: metricWidgetQueryParams.op,
                groupBy: metricWidgetQueryParams.groupBy,
              },
            ]}
            focusedSeries={metricWidgetQueryParams.focusedSeries}
            displayType={metricWidgetQueryParams.displayType}
            filters={selection}
            onChange={(_, data) => {
              handleChange(data);
            }}
            context="dashboard"
          />
          <MetricDetails widget={metricWidgetQueryParams} />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <LinkButton
              to={getDdmUrl(organization.slug, {
                widgets: [metricWidgetQueryParams],
                project: selection.projects,
                ...selection.datetime,
                environment: selection.environments,
              })}
            >
              {t('Open in Metrics')}
            </LinkButton>
            <Button onClick={closeModal}>{t('Close')}</Button>
            <Button priority="primary" onClick={handleSubmit}>
              {t('Save changes')}
            </Button>
          </ButtonBar>
        </Footer>
      </OrganizationContext.Provider>
    </Fragment>
  );
}

function WidgetTitle({value, displayValue, placeholder, onSubmit}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState<string>(value);

  return (
    <WidgetTitleRow>
      {isEditingTitle ? (
        <Input
          value={title}
          placeholder={placeholder}
          onChange={e => {
            setTitle?.(e.target.value);
          }}
        />
      ) : (
        <h3>{displayValue}</h3>
      )}
      <Button
        aria-label="Edit Title"
        size="sm"
        borderless
        icon={isEditingTitle ? <IconCheckmark size="sm" /> : <IconEdit size="sm" />}
        priority={isEditingTitle ? 'primary' : 'default'}
        onClick={() => {
          if (isEditingTitle) {
            onSubmit?.(title);
          }
          setIsEditingTitle(curr => !curr);
        }}
      />
    </WidgetTitleRow>
  );
}

export function ContextMenu({metricsQuery}: {metricsQuery: MetricsQuery}) {
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
        createAlert?.();
      },
    };
    const settingsItem = {
      leadingItems: [<IconSettings key="icon" />],
      key: 'settings',
      label: t('Metric Settings'),
      disabled: !customMetric,
      onAction: () => {
        navigateTo(
          `/settings/projects/:projectId/metrics/${encodeURIComponent(metricsQuery.mri)}`,
          router
        );
      },
    };

    return customMetric ? [addAlertItem, settingsItem] : [addAlertItem];
  }, [createAlert, metricsQuery.mri, router]);

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

export default MetricWidgetViewerModal;

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
