import {cloneElement, isValidElement} from 'react';

import Feature from 'sentry/components/acl/feature';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  organization: Organization;
  children?: React.ReactNode;
};

function TeamInsightsContainer({children, organization}: Props) {
  return (
    <Feature organization={organization} features={['team-insights']}>
      <NoProjectMessage organization={organization}>
        <SentryDocumentTitle title={t('Project Reports')} orgSlug={organization.slug}>
          {children && isValidElement(children)
            ? cloneElement(children, {
                organization,
              })
            : (children as React.ReactChild)}
        </SentryDocumentTitle>
      </NoProjectMessage>
    </Feature>
  );
}

export default withOrganization(TeamInsightsContainer);
