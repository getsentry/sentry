import {createContext, useContext, useMemo, useReducer} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useExplorerPanel} from 'sentry/views/seerExplorer/useExplorerPanel';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

import {NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME} from './constants';
import {PRIMARY_HEADER_HEIGHT} from './constants';

export function TopBar() {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const hasPageFrame = useHasPageFrameFeature();

  const {openExplorerPanel} = useExplorerPanel();

  const [, registerSlot] = useTopBarSlotContext();

  if (!hasPageFrame) {
    return null;
  }

  return (
    <Flex
      height={{
        sm: `${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`,
        md: `${PRIMARY_HEADER_HEIGHT}px`,
      }}
      justify="between"
      background="secondary"
      align="center"
      padding={{sm: 'sm lg', md: 'md xl'}}
      position="sticky"
      borderBottom="primary"
      top={0}
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
      }}
    >
      <SizeProvider size="sm">
        <Flex ref={registerSlot.title} align="center" gap="sm" />
        <Flex align="center" gap="md" ref={registerSlot.actions}>
          {organization && isSeerExplorerEnabled(organization) ? (
            <Button icon={<IconSeer />} onClick={openExplorerPanel}>
              {t('Ask Seer')}
            </Button>
          ) : null}

          <Flex ref={registerSlot.feedback}>
            <FeedbackButton
              aria-label={t('Give Feedback')}
              feedbackOptions={{tags: {'feedback.source': 'top_navigation'}}}
            >
              {null}
            </FeedbackButton>
          </Flex>
        </Flex>
      </SizeProvider>
    </Flex>
  );
}

type TopBarSlots = 'title' | 'actions' | 'feedback';
type TopBarSlotValue = Record<TopBarSlots, HTMLElement | null>;
type TopBarRegisterSlotValue = Record<TopBarSlots, (element: HTMLElement | null) => void>;

const TopBarSlotContext = createContext<
  [TopBarSlotValue, TopBarRegisterSlotValue] | null
>(null);

type TopBarSlotReducerState = Record<TopBarSlots, HTMLElement | null>;
type TopBarSlotReducerAction = {
  element: HTMLElement | null;
  name: TopBarSlots;
  type: 'register';
};

function topBarSlotReducer(
  state: TopBarSlotReducerState,
  action: TopBarSlotReducerAction
): TopBarSlotReducerState {
  switch (action.type) {
    case 'register':
      return {...state, [action.name]: action.element};
    default:
      unreachable(action.type);
      return state;
  }
}

export function TopBarSlotProvider({children}: {children: ReactNode}) {
  const [value, dispatch] = useReducer(topBarSlotReducer, {
    title: null,
    actions: null,
    feedback: null,
  });

  const registerSlot = useMemo(
    () => ({
      title: (element: HTMLElement | null) =>
        dispatch({type: 'register', name: 'title', element}),
      actions: (element: HTMLElement | null) =>
        dispatch({type: 'register', name: 'actions', element}),
      feedback: (element: HTMLElement | null) =>
        dispatch({type: 'register', name: 'feedback', element}),
    }),
    []
  );

  return (
    <TopBarSlotContext.Provider value={[value, registerSlot]}>
      {children}
    </TopBarSlotContext.Provider>
  );
}

function useTopBarSlotContext() {
  const context = useContext(TopBarSlotContext);
  if (!context) {
    throw new Error('TopBarSlotContext not found');
  }
  return context;
}

interface SlotProps {
  children: ReactNode;
}

function makeSlotOutlet(name: TopBarSlots) {
  function Slot({children}: SlotProps) {
    const organization = useOrganization({allowNull: true});
    const [value] = useTopBarSlotContext();

    // If the organization doesn't have the page frame feature,
    // then render the children in their natural JSX position
    if (!organization?.features.includes('page-frame')) {
      return children;
    }

    if (!value[name]) {
      return null;
    }

    return createPortal(children, value[name]);
  }

  Slot.displayName = `TopBarSlot.${name}`;
  return Slot;
}

export const TopBarSlot = {
  Title: makeSlotOutlet('title'),
  Actions: makeSlotOutlet('actions'),
  Feedback: makeSlotOutlet('feedback'),
};
