import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import RelayWrapper from './relayWrapper';

function OrganizationRelay(props: Omit<RelayWrapper['props'], 'organization'>) {
  const organization = useOrganization();
  return (
    <Feature
      organization={organization}
      features="relay"
      hookName="feature-disabled:relay"
      renderDisabled={p => (
        <Panel>
          <PanelBody withPadding>
            <FeatureDisabled
              features={p.features}
              hideHelpToggle
              featureName={t('Relay')}
            />
          </PanelBody>
        </Panel>
      )}
    >
      <RelayWrapper organization={organization} {...props} />
    </Feature>
  );
}

export default OrganizationRelay;
