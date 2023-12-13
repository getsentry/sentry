import {useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {createDashboard, updateDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import LoadingError from 'sentry/components/loadingError';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, SelectValue} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DashboardDetails,
  DashboardListItem,
  MAX_WIDGETS,
} from 'sentry/views/dashboards/types';
import {NEW_DASHBOARD_ID} from 'sentry/views/dashboards/widgetBuilder/utils';
import {OrganizationContext} from 'sentry/views/organizationContext';

export type AddToDashboardModalProps = {
  location: Location;
  newDashboard: DashboardDetails;
  organization: Organization;
  router: InjectedRouter;
};

type Props = ModalRenderProps & AddToDashboardModalProps;

const SELECT_DASHBOARD_MESSAGE = t('Select a dashboard');

function CreateDashboardFromScratchpadModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  router,
  newDashboard,
}: Props) {
  const api = useApi();
  const [selectedDashboardId, setSelectedDashboardId] =
    useState<string>(NEW_DASHBOARD_ID);

  const {data: dashboards, isError: isDashboardError} = useApiQuery<DashboardListItem[]>(
    [
      `/organizations/${organization.slug}/dashboards/`,
      {
        query: {sort: 'myDashboardsAndRecentlyViewed'},
      },
    ],
    {staleTime: 0}
  );

  const shouldFetchSelectedDashboard = selectedDashboardId !== NEW_DASHBOARD_ID;

  const {data: selectedDashboard, isError: isSelectedDashboardError} =
    useApiQuery<DashboardDetails>(
      [`/organizations/${organization.slug}/dashboards/${selectedDashboardId}/`],
      {
        staleTime: 0,
        enabled: shouldFetchSelectedDashboard,
      }
    );

  useEffect(() => {
    if (isSelectedDashboardError) {
      addErrorMessage(t('Unable to load dashboard'));
    }
  }, [isSelectedDashboardError]);

  async function createOrUpdateDashboard() {
    if (selectedDashboardId === NEW_DASHBOARD_ID) {
      const dashboard = await createDashboard(api, organization.slug, newDashboard);

      addSuccessMessage(t('Successfully created dashboard'));
      return dashboard;
    }

    if (!selectedDashboard) {
      return null;
    }

    const updatedDashboard = {
      ...selectedDashboard,
      widgets: [...selectedDashboard.widgets, ...newDashboard.widgets],
    };

    const dashboard = await updateDashboard(api, organization.slug, updatedDashboard);

    addSuccessMessage(t('Successfully added widgets to dashboard'));
    return dashboard;
  }

  async function handleAddAndStayOnCurrentPage() {
    await createOrUpdateDashboard();
    closeModal();
  }

  async function handleGoToDashboard() {
    const dashboard = await createOrUpdateDashboard();

    if (!dashboard) {
      return;
    }

    router.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/${dashboard.id}/`,
      })
    );

    closeModal();
  }

  return (
    <OrganizationContext.Provider value={organization}>
      <Header closeButton>
        <h4>{t('Add to Dashboard')}</h4>
      </Header>
      <Body>
        {isDashboardError && <LoadingError message={t('Unable to load dashboards')} />}
        <Wrapper>
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
                  disabled: widgetDisplay.length >= MAX_WIDGETS,
                  tooltip:
                    widgetDisplay.length >= MAX_WIDGETS &&
                    tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                      maxWidgets: MAX_WIDGETS,
                    }),
                  tooltipOptions: {position: 'right'},
                })),
              ]
            }
            onChange={(option: SelectValue<string>) => {
              if (option.disabled) {
                return;
              }
              setSelectedDashboardId(option.value);
            }}
          />
        </Wrapper>
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
          <Button
            disabled={isSelectedDashboardError}
            onClick={handleAddAndStayOnCurrentPage}
            title={SELECT_DASHBOARD_MESSAGE}
          >
            {t('Add + Stay on this Page')}
          </Button>
          <Button
            disabled={isSelectedDashboardError}
            priority="primary"
            onClick={handleGoToDashboard}
            title={SELECT_DASHBOARD_MESSAGE}
          >
            {t('Open in Dashboards')}
          </Button>
        </StyledButtonBar>
      </Footer>
    </OrganizationContext.Provider>
  );
}

export default CreateDashboardFromScratchpadModal;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.small}) {
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
