import type LoadingIndicator from 'sentry/components/loadingIndicator';
import type {QueryClient, QueryObserverResult} from 'sentry/utils/queryClient';
import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {PromotionData} from 'getsentry/types';
import usePromotionTriggerCheck from 'getsentry/utils/usePromotionTriggerCheck';

type InjectedPromotionProps = {
  isError?: boolean;
  isLoading?: boolean;
  promotionData?: PromotionData;
  queryClient?: QueryClient;
  refetch?: () => Promise<QueryObserverResult<PromotionData, unknown>>;
};

const withPromotions = <P extends InjectedPromotionProps>(
  WrappedComponent: React.ComponentType<P> | typeof LoadingIndicator
) => {
  function WithPromotions(props: Omit<P, keyof InjectedPromotionProps>) {
    const organization = useOrganization();

    const {isPending, isError, data, refetch} = usePromotionTriggerCheck(organization);

    const queryClient = useQueryClient();
    const innerProps = {
      promotionData: data,
      isLoading: isPending,
      isError,
      refetch,
      queryClient,
      ...props,
    } as P;
    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...(innerProps as any)} />;
  }

  return WithPromotions;
};

export default withPromotions;
