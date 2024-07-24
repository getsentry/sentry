import type {ReactNode} from 'react';
import {css} from '@emotion/react';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconClose, IconFlag, IconIssues, IconMegaphone, IconSiren} from 'sentry/icons';

import useConfiguration from '../hooks/useConfiguration';
import usePlacementCss from '../hooks/usePlacementCss';
import useToolbarRoute from '../hooks/useToolbarRoute';
import {navigationButtonCss, navigationCss} from '../styles/navigation';
import {resetButtonCss, resetDialogCss} from '../styles/reset';
import {buttonCss} from '../styles/typography';

import AlertCountBadge from './alerts/alertCountBadge';

export default function Navigation({
  setIsDisabled,
}: {
  setIsDisabled: (val: boolean) => void;
}) {
  const {trackAnalytics} = useConfiguration();
  const placement = usePlacementCss();

  return (
    <dialog
      css={[
        resetDialogCss,
        navigationCss,
        hideButtonContainerCss,
        placement.navigation.css,
      ]}
    >
      <NavButton panelName="issues" label="Issues" icon={<IconIssues />} />
      <NavButton panelName="feedback" label="User Feedback" icon={<IconMegaphone />} />
      <NavButton panelName="alerts" label="Active Alerts" icon={<IconSiren />}>
        <AlertCountBadge />
      </NavButton>
      <NavButton panelName="featureFlags" label="Feature Flags" icon={<IconFlag />} />
      <HideButton
        onClick={() => {
          setIsDisabled(true);
          trackAnalytics?.({
            eventKey: `devtoolbar.nav.hide.click`,
            eventName: `devtoolbar: Hide devtoolbar`,
          });
        }}
      />
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
    <button
      aria-label={label}
      css={[resetButtonCss, navigationButtonCss]}
      data-active-route={isActive}
      onClick={() => {
        setActivePanel(isActive ? null : panelName);
        trackAnalytics?.({
          eventKey: `devtoolbar.nav.button.${label.replace(' ', '-')}.click`,
          eventName: `devtoolbar: Toggle Nav Panel ${label} Click`,
        });
      }}
      title={label}
    >
      <InteractionStateLayer />
      {icon}
      {children}
    </button>
  );
}

const hideButtonContainerCss = css`
  :hover button {
    visibility: visible;
  }
`;
const hideButtonCss = css`
  border-radius: 50%;
  color: var(--gray300);
  height: 1.6rem;
  left: -10px;
  position: absolute;
  top: -10px;
  visibility: hidden;
  width: 1.6rem;
  z-index: 1;
`;

function HideButton({onClick}: {onClick: () => void}) {
  return (
    <button
      aria-label="Hide for this session"
      css={[resetButtonCss, buttonCss, hideButtonCss]}
      onClick={onClick}
      title="Hide for this session"
    >
      <IconClose isCircled />
    </button>
  );
}
