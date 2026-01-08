import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Hooks} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useNavContext} from 'sentry/views/nav/context';
import {
  SidebarButton,
  SidebarItemUnreadIndicator,
} from 'sentry/views/nav/primary/components';
import {NavLayout} from 'sentry/views/nav/types';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import TrialStartedSidebarItem from 'getsentry/components/trialStartedSidebarItem';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {hasPerformance, isBizPlanFamily} from 'getsentry/utils/billing';

const AUTO_OPEN_HASH = '#try-business';

type Props = Parameters<Hooks['sidebar:try-business']>[0] & {
  organization: Organization;
  subscription: Subscription;
};

const TRY_BUSINESS_SEEN_KEY = `sidebar-new-seen:try-business-v1`;

function TryBusinessNavigationItem({
  organization,
  subscription,
  onClick,
}: {
  label: string;
  onClick: () => void;
  organization: Organization;
  subscription: Subscription;
}) {
  const [tryBusinessSeen, setTryBusinessSeen] = useLocalStorageState(
    TRY_BUSINESS_SEEN_KEY,
    false
  );

  const isNew = !subscription.isTrial && subscription.canTrial;
  const showIsNew = isNew && !tryBusinessSeen;
  const {layout} = useNavContext();

  return (
    <StackedNavTrialStartedSidebarItem {...{organization, subscription}}>
      <SidebarButton
        label={t('Try Business')}
        onClick={() => {
          setTryBusinessSeen(true);
          onClick();
        }}
        analyticsKey="try-business"
      >
        <IconBusiness size="md" />
        {showIsNew && (
          <SidebarItemUnreadIndicator isMobile={layout === NavLayout.MOBILE} />
        )}
      </SidebarButton>
    </StackedNavTrialStartedSidebarItem>
  );
}

function TryBusinessSidebarItem(props: Props) {
  const [_rerenderTick, setRerenderTick] = useState(0);

  useEffect(() => {
    const search = document.location.search;
    const params = ['utm_source', 'utm_medium', 'utm_term'];

    const source = search
      ?.split('&')
      .map(param => param.split('='))
      .filter(param => params.includes(param[0]!))
      .map(param => param[1])
      .join('_');

    if (document.location.hash === AUTO_OPEN_HASH) {
      openUpsellModal({
        organization: props.organization,
        source: source || 'direct',
      });
    }
  }, [props.organization]);

  const openModal = useCallback(() => {
    openUpsellModal({organization: props.organization, source: 'try-business-sidebar'});
    // force an update so we can re-render the sidebar item with the updated localstorage
    // where the new will be gone and add a delay since the modal takes time to open
    setTimeout(() => setRerenderTick(tick => tick + 1), 200);
  }, [props.organization]);

  const labelText = useMemo(() => {
    if (props.subscription.isTrial) {
      return t('My Sentry Trial');
    }
    if (!props.subscription.canTrial) {
      return t('Upgrade Now');
    }
    if (!hasPerformance(props.subscription.planDetails)) {
      return t('Try Performance');
    }
    return t('Free Trial');
  }, [props.subscription]);

  const {subscription, organization} = props;

  if (
    (hasPerformance(subscription.planDetails) &&
      isBizPlanFamily(subscription.planDetails)) ||
    !subscription.canSelfServe
  ) {
    return null;
  }

  return (
    <TryBusinessNavigationItem
      organization={organization}
      subscription={subscription}
      label={labelText}
      onClick={openModal}
    />
  );
}

const StackedNavTrialStartedSidebarItem = styled(TrialStartedSidebarItem)`
  margin: 0;
  padding: 0;
  border-radius: ${p => p.theme.radius.md};
`;

export default withSubscription(TryBusinessSidebarItem, {noLoader: true});
