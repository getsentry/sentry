import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';

export function PreventSecondaryNavigation() {
  const organization = useOrganization();
  const testsPathname = normalizeUrl(
    `/organizations/${organization.slug}/prevent/tests/`
  );
  const tokensPathName = normalizeUrl(
    `/organizations/${organization.slug}/prevent/tokens/`
  );

  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Prevent')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="prevent-main">
          <Feature features={['prevent-test-analytics']}>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link to={testsPathname} activeTo={testsPathname}>
                {t('Tests')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </Feature>
        </SecondaryNavigation.Section>
        <Feature features={['prevent-test-analytics']}>
          <SecondaryNavigation.Section id="prevent-configure" title={t('Configure')}>
            <SecondaryNavigation.List>
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link to={tokensPathName} activeTo={tokensPathName}>
                  {t('Tokens')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            </SecondaryNavigation.List>
          </SecondaryNavigation.Section>
        </Feature>
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
