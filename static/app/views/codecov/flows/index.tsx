import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import DropdownButton from 'sentry/components/dropdownButton';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {FLOWS_PAGE_TITLE} from 'sentry/views/codecov/settings';

import FlowsTable from './list/table';
import {useDeleteFlowTemp, useFlowsTemp} from './hooks';

export default function FlowsPage() {
  const {selection} = usePageFilters();
  const {data, isLoading, isError} = useFlowsTemp({
    pageFilters: selection,
  });
  const {mutate: deleteFlow, isPending: isDeleting} = useDeleteFlowTemp();
  const navigate = useNavigate();

  const onCreate = () => {
    navigate('/codecov/flows/select-replay/');
  };

  const onDelete = (flowId: string) => {
    deleteFlow(flowId);
  };

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={FLOWS_PAGE_TITLE} />
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>{t('Flows')}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <Button
            data-test-id="flow-create"
            onClick={event => {
              event.preventDefault();
              onCreate();
            }}
            size="sm"
            priority="primary"
            icon={<IconAdd />}
          >
            {t('Create Flow')}
          </Button>
        </Layout.HeaderActions>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FiltersContainer>
            <PageFilterBar>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
            </PageFilterBar>
          </FiltersContainer>

          <FlowsTable
            data={data}
            isLoading={isLoading}
            isError={isError}
            onDeleteFlow={onDelete}
          />
        </Layout.Main>
      </Layout.Body>
    </PageFiltersContainer>
  );
}

const FiltersContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
  margin-bottom: 20px;
`;
