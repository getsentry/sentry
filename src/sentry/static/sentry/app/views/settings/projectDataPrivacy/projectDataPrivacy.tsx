import React from 'react';

import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {PanelAlert} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization} from 'app/types';

import ProjectDataPrivacyContent from './projectDataPrivacyContent';

const ProjectDataPrivacy = ({
  organization,
}: {organization: Organization}) => (
  <Feature
    features={['datascrubbers-v2']}
    organization={organization}
    renderDisabled={() => (
      <FeatureDisabled
        alert={PanelAlert}
        features={organization.features}
        featureName={t('Data Privacy - new')}
      />
    )}
  >
    <ProjectDataPrivacyContent />
  </Feature>
);

export default ProjectDataPrivacy;
