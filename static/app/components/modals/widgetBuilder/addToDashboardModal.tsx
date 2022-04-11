import {Fragment, useEffect, useState} from 'react';
import {OptionProps} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {fetchDashboards} from 'sentry/actionCreators/dashboards';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/selectControl';
import SelectOption from 'sentry/components/forms/selectOption';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {DashboardListItem, MAX_WIDGETS, Widget} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';

export type AddToDashboardModalProps = {
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

function AddToDashboardModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  selection,
  widget,
}: Props) {
  const api = useApi();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboards(api, organization.slug).then(setDashboards);
  }, []);

  function handleGoToBuilder() {
    closeModal();
    return;
  }

  function handleAddAndStayInDiscover() {
    closeModal();
    return;
  }

  const canSubmit = selectedDashboardId !== null;

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add to Dashboard')}</h4>
      </Header>

      <Body>
        <SelectControlWrapper>
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
        </SelectControlWrapper>
        {t('This is a preview of how the widget will appear in your dashboard.')}
        <WidgetCard
          api={api}
          organization={organization}
          currentWidgetDragging={false}
          isEditing={false}
          isSorting={false}
          widgetLimitReached={false}
          selection={selection}
          widget={widget}
        />
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
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
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

export default AddToDashboardModal;

const SelectControlWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-rows: repeat(2, 1fr);
    gap: ${space(1.5)};
    width: 100%;

    > button {
      width: 100%;
    }
  }
`;

export const modalCss = css`
  max-width: 700px;
  margin: 70px auto;
`;
