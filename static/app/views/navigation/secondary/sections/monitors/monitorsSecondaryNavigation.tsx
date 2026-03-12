import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_NAVIGATION_GROUP_CONFIG} from 'sentry/views/navigation/primary/config';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

export function MonitorsSecondaryNavigation() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/monitors`;

  return (
    <Fragment>
      <SecondaryNavigation.Header>
        {PRIMARY_NAVIGATION_GROUP_CONFIG[PrimaryNavigationGroup.MONITORS].label}
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="monitors-views">
          <SecondaryNavigation.Item
            to={`${baseUrl}/`}
            end
            analyticsItemName="monitors_all"
          >
            {t('All Monitors')}
          </SecondaryNavigation.Item>
          <SecondaryNavigation.Item
            to={`${baseUrl}/my-monitors/`}
            analyticsItemName="monitors_my"
          >
            {t('My Monitors')}
          </SecondaryNavigation.Item>
        </SecondaryNavigation.Section>

        <SecondaryNavigation.Section id="monitors-data-types" title={t('By Data Type')}>
          <SecondaryNavigation.Item
            to={`${baseUrl}/errors/`}
            analyticsItemName="monitors_errors"
          >
            {t('Errors')}
          </SecondaryNavigation.Item>
          <SecondaryNavigation.Item
            to={`${baseUrl}/metrics/`}
            analyticsItemName="monitors_metrics"
          >
            {t('Metrics')}
          </SecondaryNavigation.Item>
          <SecondaryNavigation.Item
            to={`${baseUrl}/crons/`}
            analyticsItemName="monitors_crons"
          >
            {t('Crons')}
          </SecondaryNavigation.Item>
          <Feature features={['uptime']}>
            <SecondaryNavigation.Item
              to={`${baseUrl}/uptime/`}
              analyticsItemName="monitors_uptime"
            >
              {t('Uptime')}
            </SecondaryNavigation.Item>
          </Feature>
          <Feature features={['organizations:preprod-size-monitors-frontend']}>
            <SecondaryNavigation.Item
              to={`${baseUrl}/mobile-builds/`}
              analyticsItemName="monitors_mobile_builds"
            >
              {t('Mobile Builds')}
            </SecondaryNavigation.Item>
          </Feature>
        </SecondaryNavigation.Section>

        <SecondaryNavigation.Section id="monitors-automations">
          <SecondaryNavigation.Item
            to={`${baseUrl}/alerts/`}
            analyticsItemName="monitors_automations"
          >
            {t('Alerts')}
          </SecondaryNavigation.Item>
        </SecondaryNavigation.Section>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
