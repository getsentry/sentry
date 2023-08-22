import {useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/types';
import {space} from 'sentry/styles/space';
import {Funnel} from 'sentry/types/funnel';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export default function CreateFunnel() {
  const [form] = useState(() => new FormModel({}));
  const organization = useOrganization();
  const {data} = useApiQuery<any>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
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
      <Form
        model={form}
        apiMethod="POST"
        apiEndpoint={`/organizations/${organization.slug}/funnel/`}
        onSubmitSuccess={(funnel: Funnel) => {
          // redirect to funnel
          browserHistory.push(
            `/organizations/${organization.slug}/funnel/${funnel.slug}/`
          );
        }}
      >
        <JsonForm title="Create Funnel" fields={fields} />
      </Form>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding: ${space(3)};
`;
