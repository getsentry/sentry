import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';

import Hook from 'sentry/components/hook';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {NavigationLayout} from 'sentry/views/navigation/types';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';

function PrimaryNavigation(props: {children: React.ReactNode}) {
  const theme = useTheme();
  const {currentStepId} = useNavigationTour();
  const tourIsActive = currentStepId !== null;
  const navigationContext = useNavigationContext();
  const hoverProps = useResetActiveNavigationGroup();

  return (
    <Flex
      ref={navigationContext.navigationParentRef}
      position={tourIsActive ? undefined : 'sticky'}
      bottom={navigationContext.layout === NavigationLayout.MOBILE ? undefined : 0}
      height={navigationContext.layout === NavigationLayout.MOBILE ? undefined : '100dvh'}
      top={0}
      style={{
        zIndex: tourIsActive ? undefined : theme.zIndex.sidebarPanel,
        userSelect: 'none',
      }}
      {...hoverProps}
    >
      {props.children}
    </Flex>
  );
}

function Sidebar(props: {children: React.ReactNode}) {
  const theme = useTheme();
  const {currentStepId} = useNavigationTour();

  return (
    <Flex
      as="nav"
      aria-label="Primary Navigation"
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      padding="lg 0 md 0"
      borderRight="primary"
      background="primary"
      direction="column"
      style={{zIndex: currentStepId === null ? theme.zIndex.sidebar : undefined}}
    >
      {props.children}
    </Flex>
  );
}

function SuperuserIndicator() {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});

  return (
    <Container
      top={0}
      left={0}
      position="absolute"
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      style={{
        zIndex: theme.zIndex.initial,
        background: theme.tokens.background.danger.vibrant,
      }}
    >
      <Hook name="component:superuser-warning" organization={organization} />
    </Container>
  );
}

function Header({children}: {children: React.ReactNode}) {
  const organization = useOrganization({allowNull: true});

  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  return (
    <Flex as="header" direction="column" align="center" justify="center">
      {children}
      {showSuperuserWarning && <SuperuserIndicator />}
    </Flex>
  );
}

PrimaryNavigation.Header = Header;
PrimaryNavigation.Sidebar = Sidebar;

export {PrimaryNavigation};
