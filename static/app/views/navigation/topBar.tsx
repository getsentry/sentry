import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useOrganization} from 'sentry/utils/useOrganization';

import {PRIMARY_HEADER_HEIGHT} from './constants';

export function TopBar() {
  const organization = useOrganization({allowNull: true});

  if (!organization?.features.includes('page-frame')) {
    return null;
  }

  return (
    <Flex
      as="header"
      height={`${PRIMARY_HEADER_HEIGHT}px`}
      justify="between"
      background="secondary"
      align="center"
      padding="md lg"
    >
      <Text size="md" bold>
        We are here
      </Text>
    </Flex>
  );
}
