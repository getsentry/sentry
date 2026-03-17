import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

export function MonitorsSecondaryNavigation() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/monitors`;

  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Monitors')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="monitors-views">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/`}
                end
                analyticsItemName="monitors_all"
              >
                {t('All Monitors')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/my-monitors/`}
                analyticsItemName="monitors_my"
              >
                {t('My Monitors')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Separator />
        <SecondaryNavigation.Section id="monitors-data-types" title={t('By Data Type')}>
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/errors/`}
                analyticsItemName="monitors_errors"
              >
                {t('Errors')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/metrics/`}
                analyticsItemName="monitors_metrics"
              >
                {t('Metrics')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/crons/`}
                analyticsItemName="monitors_crons"
              >
                {t('Crons')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            <Feature features={['uptime']}>
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/uptime/`}
                  analyticsItemName="monitors_uptime"
                >
                  {t('Uptime')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
            <Feature features={['organizations:preprod-size-monitors-frontend']}>
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/mobile-builds/`}
                  analyticsItemName="monitors_mobile_builds"
                >
                  {t('Mobile Builds')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </Feature>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Separator />
        <SecondaryNavigation.Section id="monitors-automations">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/alerts/`}
                analyticsItemName="monitors_automations"
              >
                {t('Alerts')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
