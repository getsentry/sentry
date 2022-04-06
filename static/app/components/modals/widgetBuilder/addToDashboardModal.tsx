import {Fragment, useEffect, useState} from 'react';
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
import {Organization, SelectValue} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {DashboardListItem, MAX_WIDGETS} from 'sentry/views/dashboardsV2/types';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

export type AddToDashboardModalProps = {
  iconColor: string;
  onConfirm: () => void;
  organization: Organization;
  widget: WidgetTemplate;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

function AddToDashboardModal({Header, Body, Footer, closeModal, organization}: Props) {
  const api = useApi();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboards(api, organization.slug).then(setDashboards);
  }, []);

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
          <div style={{marginTop: '8px', height: '200px', backgroundColor: 'green'}}>
            Preview
          </div>
        </div>
      </Body>

      <Footer>
        <ButtonBar gap={1.5}>
          <Button onClick={() => alert('Stay')}>{t('Add + Stay in Discover')}</Button>
          <Button priority="primary" onClick={() => alert('Go')}>
            {t('Open in Widget Builder')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

export default AddToDashboardModal;

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;
