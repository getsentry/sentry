import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {FLOWS_PAGE_TITLE} from 'sentry/views/codecov/settings';

import {useLocalStorageFlows} from './hooks/useFlows';
import FlowsTable from './list/table';
import FlowsTabs from './tabs';

export default function FlowsPage() {
  const {flows, isLoading, deleteFlow} = useLocalStorageFlows();
  const navigate = useNavigate();

  const handleOpenCreateFlow = () => {
    // Navigate to the select replay page instead of opening a modal
    navigate('/codecov/flows/select-replay');
  };

  const response = {
    data: flows,
    isLoading,
    error: null,
  };

  return (
    <SentryDocumentTitle title={FLOWS_PAGE_TITLE}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{t('Flows')}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <DropdownMenu
            items={getWebItems(handleOpenCreateFlow)}
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

function getWebItems(handleOpenCreateFlow: () => void): MenuItemProps[] {
  return [
    {
      key: 'from-replay',
      label: t('From existing session replay'),
      textValue: 'from existing session replay',
      onAction: handleOpenCreateFlow,
    },
  ] satisfies MenuItemProps[];
}
