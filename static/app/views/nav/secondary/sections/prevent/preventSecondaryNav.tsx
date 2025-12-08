import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {makePreventPathname} from 'sentry/views/prevent/pathnames';
import {
  PREVENT_AI_BASE_URL,
  TESTS_BASE_URL,
  TOKENS_BASE_URL,
} from 'sentry/views/prevent/settings';

function PreventSecondaryNav() {
  const organization = useOrganization();
  const testsPathname = makePreventPathname({
    organization,
    path: `/${TESTS_BASE_URL}/`,
  });
  const tokensPathName = makePreventPathname({
    organization,
    path: `/${TOKENS_BASE_URL}/`,
  });
  const preventAIPathName = makePreventPathname({
    organization,
    path: `/${PREVENT_AI_BASE_URL}/`,
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
          <SecondaryNav.Item
            to={`${preventAIPathName}new/`}
            activeTo={`${preventAIPathName}new/`}
          >
            {t('AI Code Review')}
          </SecondaryNav.Item>
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

export default PreventSecondaryNav;
