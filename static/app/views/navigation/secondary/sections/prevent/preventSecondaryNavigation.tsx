import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_NAVIGATION_GROUP_CONFIG} from 'sentry/views/navigation/primary/config';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';
import {PrimaryNavigationGroup} from 'sentry/views/navigation/types';

function makePreventPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(`/organizations/${organization.slug}/prevent${path}`);
}

export function PreventSecondaryNavigation() {
  const organization = useOrganization();
  const testsPathname = makePreventPathname({
    organization,
    path: `/tests/`,
  });
  const tokensPathName = makePreventPathname({
    organization,
    path: `/tokens/`,
  });

  return (
    <Fragment>
      <SecondaryNavigation.Header>
        {PRIMARY_NAVIGATION_GROUP_CONFIG[PrimaryNavigationGroup.PREVENT].label}
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="prevent-main">
          <Feature features={['prevent-test-analytics']}>
            <SecondaryNavigation.Item to={testsPathname} activeTo={testsPathname}>
              {t('Tests')}
            </SecondaryNavigation.Item>
          </Feature>
        </SecondaryNavigation.Section>
        <Feature features={['prevent-test-analytics']}>
          <SecondaryNavigation.Section id="prevent-configure" title={t('Configure')}>
            <SecondaryNavigation.Item to={tokensPathName} activeTo={tokensPathName}>
              {t('Tokens')}
            </SecondaryNavigation.Item>
          </SecondaryNavigation.Section>
        </Feature>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
