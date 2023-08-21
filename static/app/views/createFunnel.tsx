import {useState} from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/types';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function CreateFunnel() {
  const [form] = useState(() => new FormModel({}));
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const {data, isLoading} = useApiQuery<any>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          ...location.query,
          field: ['transaction', 'count()', 'project', 'project.id'],
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );
  const allTransactions = (data?.data || []).filter(
    (transaction: any) => !!transaction.transaction
  );
  // const projects = allTransactions.map((transaction: any) => transaction.project))
  const projectIList = uniq(
    allTransactions.map((transaction: any) => transaction['project.id'])
  );
  const projectChoices = projectIList.map((projectId: any) => [
    projectId,
    allTransactions.find((transaction: any) => transaction['project.id'] === projectId)
      .project,
  ]);

  // TODO: Filter properly
  // const transactionsForProject = allTransactions.filter(
  //   (transaction: any) => transaction.project === form.getValue('project')
  // );
  const transactionsForProject = allTransactions;

  const fields: Field[] = [
    {
      name: 'name',
      type: 'text',
      label: 'Name',
    },
    {
      name: 'project',
      type: 'select',
      label: 'Project',
      choices: projectChoices,
    },
    {
      name: 'startingTransaction',
      type: 'select',
      label: 'Starting Transaction',
      choices: transactionsForProject.map((transaction: any) => [
        transaction.transaction,
        transaction.transaction,
      ]),
    },
    {
      name: 'endingTransaction',
      type: 'select',
      label: 'Ending Transaction',
      choices: transactionsForProject.map((transaction: any) => [
        transaction.transaction,
        transaction.transaction,
      ]),
    },
  ];
  return (
    <Wrapper>
      <h1>Create Funnel</h1>
      <PageFiltersContainer>
        <PageFilterBar condensed>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
      </PageFiltersContainer>
      <Form
        model={form}
        apiMethod="POST"
        apiEndpoint={`/organizations/${organization.slug}/funnel/`}
      >
        <JsonForm title="Create Funnel" fields={fields} />
      </Form>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${space(3)};
`;
