import {type ReactNode, useContext} from 'react';

import {AnalyticsContext} from 'sentry/components/devtoolbar/components/analyticsProvider';
import SessionStatusBadge from 'sentry/components/devtoolbar/components/releases/sessionStatusBadge';
import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import {
  IconClose,
  IconFlag,
  IconIssues,
  IconMegaphone,
  IconPlay,
  IconReleases,
  IconSiren,
} from 'sentry/icons';

import usePlacementCss from '../hooks/usePlacementCss';
import useToolbarRoute from '../hooks/useToolbarRoute';
import {navigationCss} from '../styles/navigation';
import {resetDialogCss} from '../styles/reset';

import AlertBadge from './alerts/alertBadge';
import IconButton from './navigation/iconButton';

export default function Navigation({
  setIsDisabled,
}: {
  setIsDisabled: (val: boolean) => void;
}) {
  const {trackAnalytics} = useConfiguration();
  const placement = usePlacementCss();

  const {state: route} = useToolbarRoute();
  const {eventName, eventKey} = useContext(AnalyticsContext);
  const isRouteActive = !!route.activePanel;

  return (
    <dialog
      css={[resetDialogCss, navigationCss, placement.navigation.css]}
      data-has-active={isRouteActive}
    >
      <IconButton
        onClick={() => {
          trackAnalytics?.({
            eventKey: eventKey + '.hide.click',
            eventName: eventName + ' hide devtoolbar clicked',
          });
          setIsDisabled(true);
        }}
        title="Hide for this session"
        icon={<IconClose />}
      />

      <hr style={{margin: 0, width: '100%'}} />

      <NavButton panelName="issues" label="Issues" icon={<IconIssues />} />
      <NavButton panelName="feedback" label="User Feedback" icon={<IconMegaphone />} />
      <NavButton panelName="alerts" label="Active Alerts" icon={<IconSiren />}>
        <AlertBadge />
      </NavButton>
      <NavButton panelName="featureFlags" label="Feature Flags" icon={<IconFlag />} />
      <NavButton panelName="releases" label="Releases" icon={<IconReleases />}>
        <SessionStatusBadge />
      </NavButton>
      <NavButton panelName="replay" label="Session Replay" icon={<IconPlay />} />
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
