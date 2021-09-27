import {cloneElement, isValidElement} from 'react';

import Feature from 'app/components/acl/feature';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  children?: React.ReactNode;
};

function TeamInsightsContainer({children, organization}: Props) {
  return (
    <Feature organization={organization} features={['team-insights']}>
      <SentryDocumentTitle title={t('Project Reports')} orgSlug={organization.slug}>
        {children && isValidElement(children)
          ? cloneElement(children, {
              organization,
            })
          : children}
      </SentryDocumentTitle>
    </Feature>
  );
}

export default withOrganization(TeamInsightsContainer);
