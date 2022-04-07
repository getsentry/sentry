import {Fragment, useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {OptionProps} from 'react-select';
import {css} from '@emotion/react';

import {fetchDashboards} from 'sentry/actionCreators/dashboards';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/selectControl';
import SelectOption from 'sentry/components/forms/selectOption';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {
  DashboardListItem,
  MAX_WIDGETS,
  WidgetQuery,
} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

export type AddToDashboardModalProps = {
  iconColor: string;
  onConfirm: () => void;
  organization: Organization;
  query: WidgetQuery;
  router: InjectedRouter;
  selection: PageFilters;
  widget: WidgetTemplate;

  // TODO(nar): Change this from any
  widgetAsQueryParams: any;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

function AddToDashboardModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  widgetAsQueryParams,
  query,
  router,
}: Props) {
  const api = useApi();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboards(api, organization.slug).then(setDashboards);
  }, []);

  function handleGoToBuilder() {
    const pathname =
      selectedDashboardId === 'new'
        ? `/organizations/${organization.slug}/dashboards/new/widget/new/`
        : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/widget/new/`;

    router.push({
      pathname,
      query: widgetAsQueryParams,
    });
    closeModal();
  }

  function handleAddAndStayInDiscover() {
    return;
  }

  const canSubmit = selectedDashboardId !== null;

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add to Dashboard')}</h4>
      </Header>

      <Body>
        <SelectControl
          disabled={dashboards === null}
          menuPlacement="auto"
          name="dashboard"
          placeholder={t('Select Dashboard')}
          value={selectedDashboardId}
          options={
            dashboards && [
              {label: t('+ Create New Dashboard'), value: 'new'},
              ...dashboards.map(({title, id, widgetDisplay}) => ({
                label: title,
                value: id,
                isDisabled: widgetDisplay.length >= MAX_WIDGETS,
              })),
            ]
          }
          onChange={(option: SelectValue<string>) => {
            if (option.disabled) {
              return;
            }
            setSelectedDashboardId(option.value);
          }}
          components={{
            Option: ({label, data, ...optionProps}: OptionProps<any>) => (
              <Tooltip
                disabled={!!!data.isDisabled}
                title={tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                  maxWidgets: MAX_WIDGETS,
                })}
                containerDisplayMode="block"
                position="right"
              >
                <SelectOption label={label} data={data} {...(optionProps as any)} />
              </Tooltip>
            ),
          }}
        />
        <div style={{marginTop: '16px'}}>
          {t('This is a preview of how the widget will appear in your dashboard.')}
          <WidgetCard
            api={api}
            organization={organization}
            currentWidgetDragging={false}
            isEditing={false}
            isSorting={false}
            widgetLimitReached={false}
            // Override selection to 24hr here because
            selection={{
              projects: [],
              environments: [],
              datetime: {
                start: widgetAsQueryParams.start,
                end: widgetAsQueryParams.end,
                period: widgetAsQueryParams.statsPeriod,
                utc: widgetAsQueryParams.utc,
              },
            }}
            widget={{
              title: widgetAsQueryParams.defaultTitle,
              displayType: widgetAsQueryParams.displayType,
              queries: [query],
              interval: '5m',
            }}
          />
        </div>
      </Body>

      <Footer>
        <ButtonBar gap={1.5}>
          <Button
            onClick={handleAddAndStayInDiscover}
            disabled={!canSubmit}
            title={canSubmit ? undefined : t('Select a dashboard')}
          >
            {t('Add + Stay in Discover')}
          </Button>
          <Button
            priority="primary"
            onClick={handleGoToBuilder}
            disabled={!canSubmit}
            title={canSubmit ? undefined : t('Select a dashboard')}
          >
            {t('Open in Widget Builder')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default withPageFilters(AddToDashboardModal);

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;
