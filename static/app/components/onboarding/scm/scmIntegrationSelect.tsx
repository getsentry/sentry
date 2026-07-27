import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {useOrganization} from 'sentry/utils/useOrganization';

import {type ScmAnalyticsFlow, scmFlowVariantParams} from './scmAnalyticsFlow';

interface ScmIntegrationSelectProps {
  analyticsFlow: ScmAnalyticsFlow;
  integrations: Integration[];
  onChange: (integration: Integration) => void;
  selectedIntegration: Integration;
}

/**
 * Compact dropdown for choosing which connected SCM integration (provider plus
 * org/account) to search repositories within. The trigger shows the selected
 * integration's provider icon and name; the menu lists every active
 * integration and links out to integration settings via a "Manage providers"
 * footer.
 */
export function ScmIntegrationSelect({
  analyticsFlow,
  integrations,
  onChange,
  selectedIntegration,
}: ScmIntegrationSelectProps) {
  const organization = useOrganization();

  const options = integrations.map(integration => ({
    value: integration.id,
    label: integration.name,
    // The label is a plain string today, but set textValue explicitly so the
    // option stays filterable if the label ever becomes a React element.
    textValue: integration.name,
    leadingItems: getIntegrationIcon(integration.provider.key, 'sm'),
  }));

  return (
    <CompactSelect
      size="md"
      value={selectedIntegration.id}
      options={options}
      onChange={option => {
        const next = integrations.find(integration => integration.id === option.value);
        if (next) {
          onChange(next);
        }
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          icon={getIntegrationIcon(selectedIntegration.provider.key, 'sm')}
        >
          {selectedIntegration.name}
        </OverlayTrigger.Button>
      )}
      menuFooter={({closeOverlay}) => (
        <MenuComponents.CTALinkButton
          icon={<IconSettings />}
          to={`/settings/${organization.slug}/integrations/?category=source%20code%20management`}
          onClick={() => {
            trackAnalytics('project_creation.manage_providers_clicked', {
              organization,
              ...scmFlowVariantParams(analyticsFlow),
            });
            closeOverlay();
          }}
        >
          {t('Manage providers')}
        </MenuComponents.CTALinkButton>
      )}
    />
  );
}
