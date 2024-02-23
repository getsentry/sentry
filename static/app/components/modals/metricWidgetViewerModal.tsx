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
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconAdd,
  IconCheckmark,
  IconClose,
  IconEdit,
  IconEllipsis,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {getDdmUrl, getWidgetTitle, isCustomMetric} from 'sentry/utils/metrics';
import {emptyMetricsQueryWidget} from 'sentry/utils/metrics/constants';
import {convertToDashboardWidget} from 'sentry/utils/metrics/dashboard';
import type {MetricQueryWidgetParams, MetricsQuery} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiRequestQuery} from 'sentry/utils/metrics/useMetricsQuery';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {
  getMetricQueries,
  toMetricDisplayType,
} from 'sentry/views/dashboards/metrics/utils';
import {WidgetDescription} from 'sentry/views/dashboards/widgetCard';
import {getCreateAlert} from 'sentry/views/ddm/metricQueryContextMenu';
import {Query} from 'sentry/views/ddm/queries';
import {MetricWidget} from 'sentry/views/ddm/widget';
import {MetricDetails} from 'sentry/views/ddm/widgetDetails';
import {OrganizationContext} from 'sentry/views/organizationContext';

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
  dashboardFilters,
}: Props) {
  const {selection} = usePageFilters();
  const [metricWidgetQueries, setMetricWidgetQueries] = useState<
    MetricsQueryApiRequestQuery[]
  >(getMetricQueries(widget, dashboardFilters));

  const widgetMQL = useMemo(
    () => getWidgetTitle(metricWidgetQueries),
    [metricWidgetQueries]
  );

  const [editedTitle, setEditedTitle] = useState<string>(widget.title);
  // If user renamed the widget, dislay that title, otherwise display the MQL
  const titleToDisplay = editedTitle === '' ? widgetMQL : editedTitle;

  const handleChange = useCallback(
    (data: Partial<MetricQueryWidgetParams>, index: number) => {
      setMetricWidgetQueries(curr => {
        const updated = [...curr];
        updated[index] = {...updated[index], ...data};
        return updated;
      });
    },
    [setMetricWidgetQueries]
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      setEditedTitle(value || widgetMQL);
    },
    [setEditedTitle, widgetMQL]
  );

  const addQuery = useCallback(() => {
    setMetricWidgetQueries(curr => [...curr, emptyMetricsQueryWidget]);
  }, [setMetricWidgetQueries]);

  const removeQuery = useCallback(
    (index: number) => {
      setMetricWidgetQueries(curr => {
        const updated = [...curr];
        updated.splice(index, 1);
        return updated;
      });
    },
    [setMetricWidgetQueries]
  );

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      metricWidgetQueries.map(query => ({
        ...query,
        ...selection,
      })),
      toMetricDisplayType(widget.displayType)
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
    metricWidgetQueries,
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
          <Queries
            metricWidgetQueries={metricWidgetQueries}
            handleChange={handleChange}
            addQuery={addQuery}
            removeQuery={removeQuery}
          />
          <MetricWidget
            queries={metricWidgetQueries}
            displayType={toMetricDisplayType(widget.displayType)}
            filters={selection}
            onChange={(_, data) => {
              handleChange(data as MetricQueryWidgetParams, 0);
            }}
            context="dashboard"
          />
          <MetricDetails
            mri={metricWidgetQueries[0].mri}
            query={metricWidgetQueries[0].query}
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <LinkButton
              to={getDdmUrl(organization.slug, {
                widgets: metricWidgetQueries,
                ...selection.datetime,
                project: selection.projects,
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

function Queries({metricWidgetQueries, handleChange, addQuery, removeQuery}) {
  const {selection} = usePageFilters();

  return (
    <QueriesWrapper>
      {metricWidgetQueries.map((query, index) => (
        <Query
          key={index}
          widget={query}
          projects={selection.projects}
          onChange={data => handleChange(data, index)}
          contextMenu={
            <ContextMenu
              removeQuery={removeQuery}
              queryIndex={index}
              canRemoveQuery={metricWidgetQueries.length > 1}
              metricsQuery={query}
            />
          }
        />
      ))}
      <Button size="sm" icon={<IconAdd isCircled />} onClick={addQuery}>
        Add query
      </Button>
    </QueriesWrapper>
  );
}

function ContextMenu({
  metricsQuery,
  removeQuery,
  canRemoveQuery,
  queryIndex,
}: {
  canRemoveQuery: boolean;
  metricsQuery: MetricsQuery;
  queryIndex: number;
  removeQuery: (index: number) => void;
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
        createAlert?.();
      },
    };
    const removeQueryItem = {
      leadingItems: [<IconClose key="icon" />],
      key: 'delete',
      label: t('Remove Query'),
      disabled: !canRemoveQuery,
      onAction: () => {
        removeQuery(queryIndex);
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

    return customMetric
      ? [addAlertItem, removeQueryItem, settingsItem]
      : [addAlertItem, removeQueryItem];
  }, [createAlert, metricsQuery.mri, removeQuery, canRemoveQuery, queryIndex, router]);

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

const QueriesWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;
