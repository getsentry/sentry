import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function MonitorsSecondaryNav() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/monitors`;

  return (
    <Fragment>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.MONITORS].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section id="monitors-views">
          <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="monitors_all">
            {t('All Monitors')}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            to={`${baseUrl}/my-monitors/`}
            analyticsItemName="monitors_my"
          >
            {t('My Monitors')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>

        <SecondaryNav.Section id="monitors-data-types" title={t('By Data Type')}>
          <SecondaryNav.Item
            to={`${baseUrl}/errors/`}
            analyticsItemName="monitors_errors"
          >
            {t('Errors')}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            to={`${baseUrl}/metrics/`}
            analyticsItemName="monitors_metrics"
          >
            {t('Metrics')}
          </SecondaryNav.Item>
          <SecondaryNav.Item to={`${baseUrl}/crons/`} analyticsItemName="monitors_crons">
            {t('Crons')}
          </SecondaryNav.Item>
          <Feature features={['uptime']}>
            <SecondaryNav.Item
              to={`${baseUrl}/uptime/`}
              analyticsItemName="monitors_uptime"
            >
              {t('Uptime')}
            </SecondaryNav.Item>
          </Feature>
        </SecondaryNav.Section>

        <SecondaryNav.Section id="monitors-automations">
          <SecondaryNav.Item
            to={`${baseUrl}/alerts/`}
            analyticsItemName="monitors_automations"
          >
            {t('Alerts')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
      </SecondaryNav.Body>
    </Fragment>
  );
}
