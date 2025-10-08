import {Fragment, useCallback, useEffect, useState, type ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {fetchDashboard, fetchDashboards} from 'sentry/actionCreators/dashboards';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Select} from 'sentry/components/core/select';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  DashboardCreateLimitWrapper,
  type DashboardCreateLimitWrapperResult,
} from 'sentry/views/dashboards/createLimitWrapper';
import type {DashboardDetails, DashboardListItem} from 'sentry/views/dashboards/types';
import {MAX_WIDGETS} from 'sentry/views/dashboards/types';
import {getSavedPageFilters} from 'sentry/views/dashboards/utils';
import {NEW_DASHBOARD_ID} from 'sentry/views/dashboards/widgetBuilder/utils';

export type LinkToDashboardModalProps = {
  source?: string; // TODO: perhpas make this an enum
};

type Props = ModalRenderProps & LinkToDashboardModalProps;

const SELECT_DASHBOARD_MESSAGE = t('Select a dashboard');

export function LinkToDashboardModal({Header, Body, Footer, closeModal}: Props) {
  const api = useApi();
  const navigate = useNavigate();
  const organization = useOrganization();
  const [dashboards, setDashboards] = useState<DashboardListItem[] | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardDetails | null>(
    null
  );
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);

  const {dashboardId: currentDashboardId} = useParams<{dashboardId: string}>();

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    fetchDashboards(api, organization.slug).then(response => {
      // If component has unmounted, dont set state
      if (unmounted) {
        return;
      }

      setDashboards(response);
    });

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug]);

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    if (selectedDashboardId === NEW_DASHBOARD_ID || selectedDashboardId === null) {
      setSelectedDashboard(null);
    } else {
      fetchDashboard(api, organization.slug, selectedDashboardId).then(response => {
        // If component has unmounted, dont set state
        if (unmounted) {
          return;
        }

        setSelectedDashboard(response);
      });
    }

    return () => {
      unmounted = true;
    };
  }, [api, organization.slug, selectedDashboardId]);

  const canSubmit = selectedDashboardId !== null;

  const getOptions = useCallback(
    (
      hasReachedDashboardLimit: boolean,
      isLoading: boolean,
      limitMessage: ReactNode | null
    ) => {
      if (dashboards === null) {
        return null;
      }

      return [
        {
          label: t('+ Create New Dashboard'),
          value: 'new',
          disabled: hasReachedDashboardLimit || isLoading,
          tooltip: hasReachedDashboardLimit ? limitMessage : undefined,
          tooltipOptions: {position: 'right', isHoverable: true},
        },
        ...dashboards
          .filter(dashboard =>
            // if adding from a dashboard, currentDashboardId will be set and we'll remove it from the list of options
            currentDashboardId ? dashboard.id !== currentDashboardId : true
          )
          .map(({title, id, widgetDisplay}) => ({
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
      ].filter(Boolean) as Array<SelectValue<string>>;
    },
    [currentDashboardId, dashboards]
  );

  function goToDashboard() {
    const dashboardsPath =
      selectedDashboardId === NEW_DASHBOARD_ID
        ? `/organizations/${organization.slug}/dashboards/new/`
        : `/organizations/${organization.slug}/dashboard/${selectedDashboardId}/`;

    const pathname = dashboardsPath;

    navigate({
      pathname,
      query: {
        ...(selectedDashboard ? getSavedPageFilters(selectedDashboard) : {}),
      },
    });
    closeModal();
  }

  return (
    <Fragment>
      <Header closeButton>{t('Link to Dashboard')}</Header>
      <Body>
        <Wrapper>
          <DashboardCreateLimitWrapper>
            {({
              hasReachedDashboardLimit,
              isLoading,
              limitMessage,
            }: DashboardCreateLimitWrapperResult) => (
              <Select
                disabled={dashboards === null}
                name="dashboard"
                placeholder={t('Select Dashboard')}
                value={selectedDashboardId}
                options={getOptions(hasReachedDashboardLimit, isLoading, limitMessage)}
                onChange={(option: SelectValue<string>) => {
                  if (option.disabled) {
                    return;
                  }
                  setSelectedDashboardId(option.value);
                }}
              />
            )}
          </DashboardCreateLimitWrapper>
        </Wrapper>
      </Body>

      <Footer>
        <StyledButtonBar gap="lg">
          <Button
            disabled={!canSubmit}
            title={canSubmit ? undefined : SELECT_DASHBOARD_MESSAGE}
            onClick={() => goToDashboard()}
            aria-label={t('Link to dashboard')}
          >
            {t('Link to dashboard')}
          </Button>
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${props => props.theme.breakpoints.sm}) {
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
