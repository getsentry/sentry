import styled from '@emotion/styled';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

export function FeatureFlagSettingsButton({orgSlug}: {orgSlug: string}) {
  return (
    <DropdownMenu
      position="bottom-end"
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          icon={<IconSettings />}
          aria-label={t('Feature Flag Settings')}
        />
      )}
      size="xs"
      items={[
        {
          key: 'settings',
          label: t('Set Up Change Tracking'),
          details: (
            <ChangeTrackingDetails>
              {t(
                'Listen for additions, removals, and modifications to your feature flags.'
              )}
            </ChangeTrackingDetails>
          ),
          to: `/settings/${orgSlug}/feature-flags/change-tracking/`,
        },
        {
          key: 'docs',
          label: t('Read the Docs'),
          externalHref:
            'https://docs.sentry.io/product/issues/issue-details/feature-flags/',
        },
      ]}
    />
  );
}

const ChangeTrackingDetails = styled('div')`
  max-width: 200px;
  white-space: normal;
`;
