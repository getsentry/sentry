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
import Input from 'sentry/components/input';
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

const MISSING_NAME_MESSAGE = t('You need to name your dashboard');

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
  const [dashboardName, setDashboardName] = useState<string>(newDashboard.title);
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
  const isMissingName = selectedDashboardId === NEW_DASHBOARD_ID && !dashboardName;

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
      if (!dashboardName) {
        addErrorMessage(MISSING_NAME_MESSAGE);
        return null;
      }
      try {
        const dashboard = await createDashboard(api, organization.slug, {
          ...newDashboard,
          title: dashboardName,
        });

        addSuccessMessage(t('Successfully created dashboard'));
        return dashboard;
      } catch (err) {
        // createDashboard already shows an error message
        return null;
      }
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
    const dashboard = await createOrUpdateDashboard();
    if (dashboard) {
      closeModal();
    }
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
          {selectedDashboardId === NEW_DASHBOARD_ID && (
            <Input
              placeholder={t('Name your dashboard')}
              value={dashboardName}
              onChange={event => {
                setDashboardName(event.target.value);
              }}
            />
          )}
        </Wrapper>
      </Body>

      <Footer>
        <StyledButtonBar gap={1.5}>
          <Button
            disabled={isSelectedDashboardError || isMissingName}
            onClick={handleAddAndStayOnCurrentPage}
            title={isMissingName ? MISSING_NAME_MESSAGE : undefined}
          >
            {t('Add + Stay on this Page')}
          </Button>
          <Button
            disabled={isSelectedDashboardError || isMissingName}
            priority="primary"
            onClick={handleGoToDashboard}
            title={isMissingName ? MISSING_NAME_MESSAGE : undefined}
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
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};
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
