import {css} from '@emotion/react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconClose, IconIssues, IconMegaphone} from 'sentry/icons';

import usePlacementCss from '../hooks/usePlacementCss';
import useToolbarRoute from '../hooks/useToolbarRoute';
import {navigationButtonCss, navigationCss} from '../styles/navigation';
import {resetButtonCss, resetDialogCss} from '../styles/reset';

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
      <NavButton panelName="issues" label={'Issues'} icon={<IconIssues />} />
      <NavButton panelName="feedback" label={'User Feedback'} icon={<IconMegaphone />} />
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
  icon,
  label,
  panelName,
}: {
  icon: React.ReactNode;
  label: string;
  panelName: ReturnType<typeof useToolbarRoute>['state']['activePanel'];
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
      css={[resetButtonCss, hideButtonCss]}
      onClick={onClick}
      title="Hide for this session"
    >
      <IconClose isCircled />
    </button>
  );
}
