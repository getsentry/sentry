import moment from 'moment-timezone';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useParams} from 'sentry/utils/useParams';

import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import DetailsPage from 'admin/components/detailsPage';
import PromoCodeClaimants from 'admin/components/promoCodes/promoCodeClaimants';
import PromoCodeModal from 'admin/components/promoCodes/promoCodeModal';
import type {PromoCode} from 'admin/types';
import titleCase from 'getsentry/utils/titleCase';

function PromoCodeDetails() {
  const {codeId} = useParams<{codeId: string}>();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const ENDPOINT = `/promocodes/${codeId}/`;

  const {
    data: promoCode,
    isPending,
    isError,
    refetch,
  } = useApiQuery<PromoCode>([ENDPOINT], {
    staleTime: 0,
  });

  const onUpdateMutation = useMutation({
    mutationFn: (updatedData: Record<string, any>) => {
      return api.requestPromise(ENDPOINT, {
        method: 'PUT',
        data: updatedData,
      });
    },
    onMutate: () => {
      addLoadingMessage('Saving Changes...');
    },
    onSuccess: data => {
      addSuccessMessage(`Promo code has been updated with ${JSON.stringify(data)}.`);
      setApiQueryData<PromoCode>(queryClient, [ENDPOINT], oldData => {
        return oldData ? {...oldData, data} : undefined;
      });
    },
    onError: () => {
      addErrorMessage('There was an internal error with updating the promo code.');
      clearIndicators();
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const isActive = promoCode.status === 'active';

  const overviewPanel = (
    <DetailsContainer>
      <DetailList>
        <DetailLabel title="Code">
          <code>{promoCode.code}</code>
        </DetailLabel>
        <DetailLabel title="Campaign">{promoCode.campaign || 'n/a'}</DetailLabel>
        <DetailLabel title="Amount">${promoCode.amount}</DetailLabel>
        <DetailLabel title="Claims">
          {promoCode.numClaims}
          {promoCode.maxClaims ? ` / ${promoCode.maxClaims}` : null}
        </DetailLabel>
        <DetailLabel title="New Only">{promoCode.newOnly ? 'Yes' : 'No'}</DetailLabel>
      </DetailList>
      <DetailList>
        <DetailLabel title="Status">{titleCase(promoCode.status)}</DetailLabel>
        <DetailLabel title="Duration">{promoCode.duration}</DetailLabel>
        <DetailLabel title="Created">
          {moment(promoCode.dateCreated).fromNow()}
        </DetailLabel>
        <DetailLabel title="Expires">
          {promoCode.dateExpires ? moment(promoCode.dateExpires).fromNow() : 'never'}
        </DetailLabel>
        <DetailLabel title="Trial Duration">
          {promoCode.trialDays ? promoCode.trialDays + ' days' : 'N/A'}
        </DetailLabel>
      </DetailList>
    </DetailsContainer>
  );

  return (
    <DetailsPage
      rootName="Promo Codes"
      name={promoCode.code}
      badges={[
        {
          name: isActive ? 'Active' : 'Inactive',
          level: isActive ? 'success' : 'danger',
        },
      ]}
      actions={[
        {
          key: 'toggle-activation',
          name: `${isActive ? 'Disable' : 'Reactivate'} Promo Code`,
          help: isActive
            ? 'Disable this promo, preventing future claims'
            : 'Restore this promo, allowing it to be claimed',
          onAction: () =>
            onUpdateMutation.mutate({
              status: isActive ? 'inactive' : 'active',
            }),
        },
        {
          key: 'edit-code',
          name: 'Edit',
          skipConfirmModal: true,
          onAction: () => {
            openModal(deps => (
              <PromoCodeModal
                {...deps}
                promoCode={promoCode}
                onSubmit={(newCode: PromoCode) => {
                  setApiQueryData<PromoCode>(queryClient, [ENDPOINT], newCode);
                }}
              />
            ));
          },
        },
      ]}
      sections={[
        {content: overviewPanel},
        {content: <PromoCodeClaimants promoCode={promoCode} />, noPanel: true},
      ]}
    />
  );
}

export default PromoCodeDetails;
