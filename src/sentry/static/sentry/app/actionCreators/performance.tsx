import {Client} from 'app/api';
import {t} from 'app/locale';
import {addErrorMessage} from 'app/actionCreators/indicator';

export function toggleKeyTransaction(
  api: Client,
  isKeyTransaction: boolean,
  orgId: string,
  projects: number[],
  transactionName: string
): Promise<undefined> {
  const promise: Promise<undefined> = api.requestPromise(
    `/organizations/${orgId}/key-transactions/`,
    {
      method: isKeyTransaction ? 'DELETE' : 'POST',
      query: {
        project: projects.map(id => String(id)),
      },
      data: {transaction: transactionName},
    }
  );

  promise.catch(response => {
    const non_field_errors = response?.responseJSON?.non_field_errors;

    if (
      Array.isArray(non_field_errors) &&
      non_field_errors.length &&
      non_field_errors[0]
    ) {
      addErrorMessage(response.responseJSON.non_field_errors[0]);
    } else {
      addErrorMessage(t('Unable to update key transaction'));
    }
  });

  return promise;
}
