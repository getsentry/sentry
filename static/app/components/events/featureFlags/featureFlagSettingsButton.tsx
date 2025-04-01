import styled from '@emotion/styled';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

export default function FeatureFlagSettingsButton({orgSlug}: {orgSlug: string}) {
  return (
    <DropdownMenu
      position="bottom-end"
      triggerProps={{
        showChevron: false,
        icon: <IconSettings />,
        'aria-label': t('Feature Flag Settings'),
      }}
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
