import {Component} from 'react';

import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import {
  SidebarButton,
  SidebarItem as NavSidebarItem,
  SidebarItemUnreadIndicator,
} from 'sentry/components/nav/primary/components';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Hooks} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

import {openUpsellModal} from 'getsentry/actionCreators/modal';
import TrialStartedSidebarItem from 'getsentry/components/trialStartedSidebarItem';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {hasPerformance, isBizPlanFamily} from 'getsentry/utils/billing';

const AUTO_OPEN_HASH = '#try-business';

type Props = Parameters<Hooks['sidebar:bottom-items']>[0] & {
  organization: Organization;
  subscription: Subscription;
};

const TRY_BUSINESS_SEEN_KEY = `sidebar-new-seen:try-business-v1`;

function TryBusinessNavigationItem({
  subscription,
  onClick,
}: {
  label: string;
  onClick: () => void;
  subscription: Subscription;
}) {
  const [tryBusinessSeen, setTryBusinessSeen] = useLocalStorageState(
    TRY_BUSINESS_SEEN_KEY,
    false
  );

  const isNew = !subscription.isTrial && subscription.canTrial;
  const showIsNew = isNew && !tryBusinessSeen;

  return (
    <NavSidebarItem>
      <SidebarButton
        label={t('Try Business')}
        onClick={() => {
          setTryBusinessSeen(true);
          onClick();
        }}
        analyticsKey="try-business"
      >
        <IconBusiness size="md" />
        {showIsNew && <SidebarItemUnreadIndicator />}
      </SidebarButton>
    </NavSidebarItem>
  );
}

class TryBusinessSidebarItem extends Component<Props> {
  componentDidMount() {
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
        organization: this.props.organization,
        source: source || 'direct',
      });
    }
  }

  openModal = () => {
    const {organization} = this.props;
    openUpsellModal({organization, source: 'try-business-sidebar'});
    // force an update so we can re-render the sidebar item with the updated localstorage
    // where the new will be gone and add a delay since the modal takes time to open
    setTimeout(() => this.forceUpdate(), 200);
  };

  get labelText() {
    const {subscription} = this.props;
    // trial active
    if (subscription.isTrial) {
      return t('My Sentry Trial');
    }
    // cannot trial so must upgrade
    if (!subscription.canTrial) {
      return t('Upgrade Now');
    }
    // special performance trial
    if (!hasPerformance(subscription.planDetails)) {
      return t('Try Performance');
    }
    // normal business trial
    return t('Free Trial');
  }

  render() {
    const {subscription, organization, ...sidebarItemProps} = this.props;

    // XXX: The try business sidebar item also acts as an upsell of the
    // performance tier. So we'll actually want to show it to all users except
    // those on the current business plan (who are on the highest plan).
    if (
      (hasPerformance(subscription.planDetails) &&
        isBizPlanFamily(subscription.planDetails)) ||
      !subscription.canSelfServe
    ) {
      return null;
    }

    return (
      <TrialStartedSidebarItem {...{organization, subscription}}>
        {prefersStackedNav() ? (
          <TryBusinessNavigationItem
            subscription={subscription}
            label={this.labelText}
            onClick={this.openModal}
          />
        ) : (
          <SidebarItem
            {...sidebarItemProps}
            id="try-business"
            icon={<IconBusiness size="md" />}
            label={this.labelText}
            onClick={this.openModal}
            key="gs-try-business"
            data-test-id="try-business-sidebar"
            isNewSeenKeySuffix="-v1"
            isNew={!subscription.isTrial && subscription.canTrial}
          />
        )}
      </TrialStartedSidebarItem>
    );
  }
}

export default withSubscription(TryBusinessSidebarItem, {noLoader: true});
