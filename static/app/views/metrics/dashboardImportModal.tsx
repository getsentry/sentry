import {Fragment, useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {createDashboard} from 'sentry/actionCreators/dashboards';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import TextArea from 'sentry/components/forms/controls/textarea';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {ParseResult} from 'sentry/utils/metrics/dashboardImport';
import {parseDashboard} from 'sentry/utils/metrics/dashboardImport';
import {useMetricsMeta} from 'sentry/utils/metrics/useMetricsMeta';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  assignDefaultLayout,
  getInitialColumnDepths,
} from 'sentry/views/dashboards/layoutUtils';
import {OrganizationContext} from 'sentry/views/organizationContext';

export function openDashboardImport(organization: Organization) {
  return openModal(
    deps => (
      <OrganizationContext.Provider value={organization}>
        <DashboardImportModal {...deps} />
      </OrganizationContext.Provider>
    ),
    {modalCss}
  );
}

type FormState = {
  dashboard: string;
  importResult: ParseResult | null;
  isValid: boolean;
  step: 'initial' | 'importing' | 'add-widgets';
};

function DashboardImportModal({Header, Body, Footer}: ModalRenderProps) {
  const api = useApi();
  const navigate = useNavigate();

  const {selection} = usePageFilters();
  // we want to get all custom metrics for organization
  const {data: metricsMeta} = useMetricsMeta({projects: [-1]}, ['custom']);

  const organization = useOrganization();

  const [formState, setFormState] = useState<FormState>({
    step: 'initial',
    dashboard: '',
    importResult: null,
    isValid: false,
  });

  const handleImportDashboard = useCallback(async () => {
    if (formState.isValid) {
      setFormState(curr => ({...curr, step: 'importing'}));

      const dashboardJson = JSON.parse(formState.dashboard);
      const importResult = await parseDashboard(dashboardJson, metricsMeta, organization);

      setFormState(curr => ({
        ...curr,
        importResult,
        step: 'add-widgets',
      }));
    }
  }, [formState.isValid, formState.dashboard, metricsMeta, organization]);

  const handleCreateDashboard = useCallback(async () => {
    const title = formState.importResult?.title ?? 'Metrics Dashboard';

    const importedWidgets = (formState.importResult?.widgets ?? [])
      // Only import the first 30 widgets because of dashboard widget limit
      .slice(0, 30);

    const newDashboard = {
      id: 'temp-id-imported-dashboard',
      title: `${title} (Imported)`,
      description: formState.importResult?.description ?? '',
      filters: {},
      dateCreated: '',
      widgets: assignDefaultLayout(importedWidgets, getInitialColumnDepths()),
      ...selection,
    };

    const dashboard = await createDashboard(api, organization.slug, newDashboard);

    navigate(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/${dashboard.id}/`,
      })
    );
  }, [formState.importResult, selection, organization, api, navigate]);

  return (
    <Fragment>
      <Header>
        <h4>{t('Import dashboard')}</h4>
      </Header>
      <Body>
        <ContentWrapper>
          {formState.step === 'initial' && (
            <JSONTextArea
              rows={4}
              maxRows={20}
              name="dashboard"
              placeholder={t('Paste dashboard JSON ')}
              value={formState.dashboard}
              onChange={e => {
                const isValid = isValidJson(e.target.value);
                setFormState(curr => ({...curr, dashboard: e.target.value, isValid}));
              }}
            />
          )}
          {formState.step === 'importing' && <LoadingIndicator />}
          {formState.step === 'add-widgets' && (
            <Fragment>
              <div>
                {t(
                  'Processed %s widgets from the dashboard',
                  formState.importResult?.report.length
                )}
              </div>
              <PanelTable headers={['Title', 'Outcome', 'Errors']}>
                {formState.importResult?.report.map(widget => {
                  return (
                    <Fragment key={widget.id}>
                      <div>{widget.title}</div>
                      <div>
                        <Tag type={widget.outcome}>{widget.outcome}</Tag>
                      </div>
                      <div>{widget.errors.join(', ')}</div>
                    </Fragment>
                  );
                })}
              </PanelTable>
              <div>
                {t(
                  'Found %s widgets that can be imported',
                  formState.importResult?.widgets.length
                )}
              </div>
            </Fragment>
          )}
        </ContentWrapper>
      </Body>
      <Footer>
        <Tooltip
          disabled={formState.isValid}
          title={t('Please input valid dashboard JSON')}
        >
          <Button
            priority="primary"
            disabled={!formState.isValid}
            onClick={
              formState.step === 'initial' ? handleImportDashboard : handleCreateDashboard
            }
          >
            {formState.step === 'initial' ? t('Import') : t('Create Dashboard')}
          </Button>
        </Tooltip>
      </Footer>
    </Fragment>
  );
}

const ContentWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};
  max-height: 70vh;
  overflow-y: scroll;
`;

const JSONTextArea = styled(TextArea)`
  min-height: 200px;
`;

const modalCss = css`
  width: 80%;
`;

const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};
