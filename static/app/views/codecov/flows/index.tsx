import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {FLOWS_PAGE_TITLE} from 'sentry/views/codecov/settings';

import {useLocalStorageFlows} from './hooks/useLocalStorageFlows';
import CreateFlowModal from './createFlowModal';
import FlowsTable from './flowsTable';
import FlowsTabs from './tabs';

export default function FlowsPage() {
  const {flows, isLoading, deleteFlow, clearAllFlows, resetToSampleData} =
    useLocalStorageFlows();
  const navigate = useNavigate();

  console.log('FlowsPage - Current flows:', flows);
  console.log('FlowsPage - Loading state:', isLoading);

  const handleDeleteFlow = (flowId: string) => {
    deleteFlow(flowId);
    addSuccessMessage(t('Flow deleted successfully.'));
  };

  const handleClearAll = () => {
    clearAllFlows();
    addSuccessMessage(t('All flows cleared.'));
  };

  const handleResetToSample = () => {
    resetToSampleData();
    addSuccessMessage(t('Reset to sample data.'));
  };

  const handleReplaySelected = (replaySlug: string) => {
    // Navigate to the flow creation page with the selected replay
    navigate(`/codecov/flows/new/?replay=${replaySlug}`);
  };

  const handleOpenCreateModal = () => {
    openModal(modalProps => (
      <CreateFlowModal {...modalProps} onReplaySelected={handleReplaySelected} />
    ));
  };

  const response = {
    data: flows,
    isLoading,
    error: null,
  };

  console.log('FlowsPage - Response object:', response);

  return (
    <SentryDocumentTitle title={FLOWS_PAGE_TITLE}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{t('Flows')}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <DropdownMenu
            items={getWebItems(handleOpenCreateModal)}
            trigger={(triggerProps, isOpen) => (
              <DropdownButton {...triggerProps} isOpen={isOpen} size="sm">
                {t('Create Flow')}
              </DropdownButton>
            )}
          />
        </Layout.HeaderActions>
        <FlowsTabs selected="flow-definitions" />
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <FlowsTable response={response} onDeleteFlow={deleteFlow} />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function getWebItems(handleOpenCreateModal: () => void): MenuItemProps[] {
  return [
    {
      key: 'from-replay',
      label: t('From existing session replay'),
      textValue: 'from existing session replay',
      onAction: handleOpenCreateModal,
    },
  ] satisfies MenuItemProps[];
}
