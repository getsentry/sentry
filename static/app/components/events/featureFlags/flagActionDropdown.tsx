import {useState} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {makeFeatureFlagSearchKey} from 'sentry/components/events/featureFlags/utils';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {Tab} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function FlagActionDropdown({
  flag,
  result,
  generateAction,
}: {
  flag: string;
  generateAction: ({
    key,
    value,
  }: {
    key: string;
    value: string;
  }) => LocationDescriptor | undefined;
  result: string;
}) {
  const {copy} = useCopyToClipboard();
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <RevealOnHover.Action visible={isVisible}>
      <StyledDropdownMenu
        position="bottom-end"
        onOpenChange={isOpen => setIsVisible(isOpen)}
        size="xs"
        trigger={triggerProps => (
          <Container
            width="25px"
            height="15px"
            minHeight="15px"
            marginTop="xs"
            padding="0 sm"
            radius="xs"
          >
            {containerProps => (
              <OverlayTrigger.IconButton
                {...triggerProps}
                {...containerProps}
                aria-label={t('Flag Details')}
                icon={<IconEllipsis />}
              />
            )}
          </Container>
        )}
        items={[
          {
            key: 'open-flag-details',
            label: t('See flag details'),
            to: {
              pathname: `${baseUrl}${Tab.DISTRIBUTIONS}/${flag}`,
              query: {...location.query, tab: DrawerTab.FEATURE_FLAGS},
            },
          },
          {
            key: 'view-issues',
            label: t('Search issues for this flag value'),
            to: generateAction({
              key: makeFeatureFlagSearchKey(flag),
              value: result.toString(),
            }),
          },
          {
            key: 'copy-value',
            label: t('Copy flag value to clipboard'),
            onAction: () =>
              copy(result, {successMessage: t('Flag value copied to clipboard.')}),
          },
        ]}
      />
    </RevealOnHover.Action>
  );
}

const StyledDropdownMenu = styled(DropdownMenu)`
  font-family: ${p => p.theme.font.family.sans};

  /* Override monospace styling that might be applied */
  [data-test-id='menu-list-item-label'] {
    font-family: ${p => p.theme.font.family.sans};
  }
`;
