import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {useIsMutating, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {EAPSpanResponse} from 'sentry/views/insights/types';

type StarTransactionParams = {
  project_id?: string;
  segment_name?: string;
};

const URL_PREFIX = '/insights/starred-segments/';

interface Props {
  segmentName: string;
  tableQueryKey: string[];
  projectId?: string | undefined;
}

type TableRow = Partial<EAPSpanResponse> &
  Pick<EAPSpanResponse, 'is_starred_transaction' | 'transaction'>;

type TableResponse = [{confidence: any; data: TableRow[]; meta: EventsMetaType}];

export function useStarredSegment({projectId, segmentName, tableQueryKey}: Props) {
  const starredSegmentMutationKey = ['star-segment', segmentName];

  const queryClient = useQueryClient();
  const organization = useOrganization();
  const api = useApi();
  const isMutating = useIsMutating({mutationKey: starredSegmentMutationKey});

  const tableData = queryClient.getQueriesData<TableResponse>({
    queryKey: tableQueryKey,
  })[0]?.[1]?.[0]?.data;

  const isStarred =
    tableData?.some(
      row => row.transaction === segmentName && row.is_starred_transaction
    ) || false;

  const url = `/organizations/${organization.slug}${URL_PREFIX}`;
  const data: StarTransactionParams = {
    project_id: projectId,
    segment_name: segmentName,
  };

  const onError = (message: string) => {
    addErrorMessage(message);
    // TODO - revert table data if the mutation fails
  };

  const onSuccess = (message: string) => {
    addSuccessMessage(message);
  };

  const {mutate: starTransaction} = useMutation({
    mutationKey: starredSegmentMutationKey,
    mutationFn: () => api.requestPromise(url, {method: 'POST', data}),
    onSuccess: () => onSuccess(t('Transaction starred')),
    onError: () => onError(t('Failed to star transaction')),
  });

  const {mutate: unstarTransaction} = useMutation({
    mutationKey: starredSegmentMutationKey,
    mutationFn: () => api.requestPromise(url, {method: 'DELETE', data}),
    onSuccess: () => onSuccess(t('Transaction unstarred')),
    onError: () => onError(t('Failed to unstar transaction')),
  });

  const toggleStarredTransaction = () => {
    if (isMutating) {
      return;
    }

    addLoadingMessage();

    if (isStarred) {
      unstarTransaction();
    } else {
      starTransaction();
    }
    queryClient.setQueriesData(
      {queryKey: tableQueryKey},
      (oldResponse: TableResponse) => {
        const oldTableData = oldResponse[0]?.data || [];
        const newData = oldTableData.map(row => {
          if (row.transaction === segmentName) {
            return {
              ...row,
              is_starred_transaction: !isStarred,
            };
          }
          return row;
        });
        return [{...oldResponse[0], data: newData}] satisfies TableResponse;
      }
    );
  };

  return {
    toggleStarredTransaction,
    isPending: isMutating > 0,
  };
}
