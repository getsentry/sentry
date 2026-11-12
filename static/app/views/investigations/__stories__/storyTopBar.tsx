import {Flex} from '@sentry/scraps/layout';

import {TopBarSlots} from 'sentry/views/navigation/topBarSlot';

/**
 * Stories have no app top bar, so a page's breadcrumbs and actions are dropped.
 * This renders the slots the page fills above it.
 */
export function StoryTopBar({children}: {children: React.ReactNode}) {
  return (
    <TopBarSlots.Provider>
      <Flex
        align="center"
        justify="between"
        gap="md"
        minHeight="48px"
        padding="sm xl"
        borderBottom="primary"
      >
        <Flex align="center" gap="sm" minWidth="0">
          <TopBarSlots.Outlet name="breadcrumbs">
            {(props, hasConsumers) =>
              hasConsumers ? (
                <Flex {...props} align="center" gap="sm" minWidth="0" />
              ) : null
            }
          </TopBarSlots.Outlet>
          <TopBarSlots.Outlet name="title">
            {props => <Flex {...props} align="center" gap="sm" minWidth="0" />}
          </TopBarSlots.Outlet>
        </Flex>
        <TopBarSlots.Outlet name="actions">
          {(props, hasConsumers) =>
            hasConsumers ? <Flex {...props} align="center" gap="sm" /> : null
          }
        </TopBarSlots.Outlet>
      </Flex>
      {children}
    </TopBarSlots.Provider>
  );
}
