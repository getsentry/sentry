import {Fragment} from 'react';

import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

export default function OnboardingAdditionalInfo({
  organization,
}: {
  organization: Organization;
}) {
  return (
    <Fragment>
      <h4 style={{marginTop: '40px'}}>{t('Additional Information')}</h4>
      <Flex column>
        <ul>
          <li>
            {tct(
              '[link:Change Tracking]: Configure Sentry to listen for additions, removals, and modifications to your feature flags.',
              {
                link: (
                  <ExternalLink
                    href={
                      'https://docs.sentry.io/product/issues/issue-details/feature-flags/#change-tracking'
                    }
                  />
                ),
              }
            )}
          </li>
        </ul>
        <Flex gap={space(1)}>
          <LinkButton to={`/issues/`} priority="primary">
            {t('Take me to Issues')}
          </LinkButton>
          <LinkButton
            to={`/settings/${organization.slug}/feature-flags/change-tracking/`}
          >
            {t('Set up Change Tracking')}
          </LinkButton>
        </Flex>
      </Flex>
    </Fragment>
  );
}
