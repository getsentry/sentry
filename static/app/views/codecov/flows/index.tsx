import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';
import {FLOWS_PAGE_TITLE} from 'sentry/views/codecov/settings';

import {useLocalStorageFlows} from './hooks/useFlows';
import FlowsTable from './list/table';
import FlowsTabs from './tabs';

export default function FlowsPage() {
  const {flows, isLoading, deleteFlow} = useLocalStorageFlows();
  const navigate = useNavigate();

  function handleOpenCreateFlow() {
    navigate('/codecov/flows/select-replay');
  }

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
            items={getCreateActions(handleOpenCreateFlow)}
            trigger={(triggerProps, isOpen) => (
              <DropdownButton
                {...triggerProps}
                isOpen={isOpen}
                size="sm"
                aria-label={t('Create Flow')}
              >
                {t('Create Flow')}
              </DropdownButton>
            )}
          />
        </Layout.HeaderActions>
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <FiltersContainer>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
              </PageFilterBar>
            </FiltersContainer>
            <FlowsTable response={response} onDeleteFlow={deleteFlow} />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function getCreateActions(handleOpenCreateFlow: () => void): MenuItemProps[] {
  return [
    {
      key: 'from-replay',
      label: t('From existing session replay'),
      textValue: 'from existing session replay',
      onAction: handleOpenCreateFlow,
    },
  ] satisfies MenuItemProps[];
}

const FiltersContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
  margin-bottom: 20px;
`;
