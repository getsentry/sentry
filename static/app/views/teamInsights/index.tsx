import {cloneElement, isValidElement} from 'react';

import Feature from 'app/components/acl/feature';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
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
      <LightWeightNoProjectMessage organization={organization}>
        <SentryDocumentTitle title={t('Project Reports')} orgSlug={organization.slug}>
          {children && isValidElement(children)
            ? cloneElement(children, {
                organization,
              })
            : children}
        </SentryDocumentTitle>
      </LightWeightNoProjectMessage>
    </Feature>
  );
}

export default withOrganization(TeamInsightsContainer);
