import {TabList} from 'sentry/components/core/tabs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  activeTab: 'policies' | 'schedules' | 'occurrences';
  // router: InjectedRouter;
};

export function EscalationPolicyHeaderTabs({activeTab}: Props) {
  const organization = useOrganization();

  return (
    <Layout.HeaderTabs value={activeTab}>
      <TabList>
        <TabList.Item
          key="policies"
          to={`/settings/${organization.slug}/escalation-policies/`}
        >
          {t('Policies')}
        </TabList.Item>
        <TabList.Item
          key="schedules"
          to={`/settings/${organization.slug}/escalation-policies/schedules/`}
        >
          {t('Schedules')}
        </TabList.Item>
        <TabList.Item
          key="occurrences"
          to={`/settings/${organization.slug}/escalation-policies/occurrences/`}
        >
          {t('Occurrences')}
        </TabList.Item>
      </TabList>
    </Layout.HeaderTabs>
  );
}
