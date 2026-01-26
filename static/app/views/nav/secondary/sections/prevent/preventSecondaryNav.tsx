import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

function makePreventPathname({
  path,
  organization,
}: {
  organization: Organization;
  path: '/' | `/${string}/`;
}) {
  return normalizeUrl(`/organizations/${organization.slug}/prevent${path}`);
}

export default function PreventSecondaryNav() {
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
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.PREVENT].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section id="prevent-main">
          <Feature features={['prevent-test-analytics']}>
            <SecondaryNav.Item to={testsPathname} activeTo={testsPathname}>
              {t('Tests')}
            </SecondaryNav.Item>
          </Feature>
        </SecondaryNav.Section>
        <Feature features={['prevent-test-analytics']}>
          <SecondaryNav.Section id="prevent-configure" title={t('Configure')}>
            <SecondaryNav.Item to={`${tokensPathName}`} activeTo={tokensPathName}>
              {t('Tokens')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        </Feature>
      </SecondaryNav.Body>
    </Fragment>
  );
}
