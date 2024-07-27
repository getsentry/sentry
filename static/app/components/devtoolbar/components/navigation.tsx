import type {ReactNode} from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import usePortalContainerContext from 'sentry/components/devtoolbar/hooks/usePortalContainerContext';
import {
  IconFlag,
  IconIssues,
  IconMegaphone,
  IconMenu,
  IconReleases,
  IconSiren,
} from 'sentry/icons';

import useConfiguration from '../hooks/useConfiguration';
import usePlacementCss from '../hooks/usePlacementCss';
import useToolbarRoute from '../hooks/useToolbarRoute';
import {navigationCss} from '../styles/navigation';
import {resetDialogCss} from '../styles/reset';

import AlertCountBadge from './alerts/alertCountBadge';
import IconButton from './navigation/iconButton';

export default function Navigation({
  setIsDisabled,
}: {
  setIsDisabled: (val: boolean) => void;
}) {
  const portalContainer = usePortalContainerContext();
  const placement = usePlacementCss();

  const {trackAnalytics} = useConfiguration();
  const {state: route} = useToolbarRoute();
  const hasActiveRoute = !!route.activePanel;

  return (
    <dialog
      css={[resetDialogCss, navigationCss, placement.navigation.css]}
      data-has-active-route={hasActiveRoute || undefined}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton title="Open Menu" icon={<IconMenu />} />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal container={portalContainer}>
          <DropdownMenu.Content className="DropdownMenuContent" side="left" align="start">
            <DropdownMenu.Item
              className="DropdownMenuItem"
              onClick={() => {
                setIsDisabled(true);
                trackAnalytics?.({
                  eventKey: `devtoolbar.nav.hide.click`,
                  eventName: `devtoolbar: Hide devtoolbar`,
                });
              }}
            >
              Hide toolbar
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="DropdownMenuSeparator" />
            <DropdownMenu.Item className="DropdownMenuItem" disabled>
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <hr css={{alignSelf: 'stretch', marginBlock: 'var(--space25)', marginInline: 0}} />

      <NavButton panelName="issues" label="Issues" icon={<IconIssues />} />
      <NavButton panelName="feedback" label="User Feedback" icon={<IconMegaphone />} />
      <NavButton panelName="alerts" label="Active Alerts" icon={<IconSiren />}>
        <AlertCountBadge />
      </NavButton>
      <NavButton panelName="featureFlags" label="Feature Flags" icon={<IconFlag />} />
      <NavButton panelName="releases" label="Releases" icon={<IconReleases />} />
    </dialog>
  );
}

function NavButton({
  children,
  icon,
  label,
  panelName,
}: {
  icon: ReactNode;
  label: string;
  panelName: ReturnType<typeof useToolbarRoute>['state']['activePanel'];
  children?: ReactNode;
}) {
  const {trackAnalytics} = useConfiguration();
  const {state, setActivePanel} = useToolbarRoute();

  const isActive = state.activePanel === panelName;

  return (
    <IconButton
      data-active-route={isActive}
      icon={icon}
      onClick={() => {
        setActivePanel(isActive ? null : panelName);
        trackAnalytics?.({
          eventKey: `devtoolbar.nav.button.${label.replace(' ', '-')}.click`,
          eventName: `devtoolbar: Toggle Nav Panel ${label} Click`,
        });
      }}
      title={label}
    >
      {children}
    </IconButton>
  );
}
