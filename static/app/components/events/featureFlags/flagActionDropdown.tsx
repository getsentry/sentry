import {useState} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {makeFeatureFlagSearchKey} from 'sentry/components/events/featureFlags/utils';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {Tab} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export default function FlagActionDropdown({
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
  const {onClick: handleCopy} = useCopyToClipboard({
    text: flag,
  });
  const location = useLocation();
  const {baseUrl} = useGroupDetailsRoute();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <StyledDropdownMenu
      position="bottom-end"
      className={isVisible ? '' : 'invisible'}
      onOpenChange={isOpen => setIsVisible(isOpen)}
      size="xs"
      triggerProps={{
        'aria-label': t('Flag Details'),
        icon: <IconEllipsis />,
        showChevron: false,
        size: 'xs',
        className: 'flag-button',
      }}
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
          onAction: handleCopy,
        },
      ]}
    />
  );
}

const StyledDropdownMenu = styled(DropdownMenu)`
  font-family: ${p => p.theme.text.family};

  /* Override monospace styling that might be applied */
  [data-test-id='menu-list-item-label'] {
    font-family: ${p => p.theme.text.family};
  }

  .flag-button {
    height: 15px;
    min-height: 15px;
    width: 25px;
    margin-top: ${space(0.5)};
    padding: 0 ${space(0.75)};
    border-radius: ${space(0.5)};
    z-index: 0;
  }
`;
