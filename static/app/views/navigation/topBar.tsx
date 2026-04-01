import {createContext, useContext, useLayoutEffect, useMemo, useReducer} from 'react';
import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
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

  const [slot, , registerSlot] = useTopBarSlotContext();

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
            {/* If no component registers a feedback button, show the default one */}
            {slot.feedback.counter ? null : (
              <FeedbackButton
                aria-label={t('Give Feedback')}
                feedbackOptions={{tags: {'feedback.source': 'top_navigation'}}}
              >
                {null}
              </FeedbackButton>
            )}
          </Flex>
        </Flex>
      </SizeProvider>
    </Flex>
  );
}

type TopBarSlots = 'title' | 'actions' | 'feedback';
type TopBarSlotValue = Record<
  TopBarSlots,
  {counter: number; element: HTMLElement | null}
>;

const TopBarSlotContext = createContext<
  | [
      TopBarSlotValue,
      React.Dispatch<TopBarSlotReducerAction>,
      Record<TopBarSlots, (element: HTMLElement | null) => void>,
    ]
  | null
>(null);

type TopBarSlotReducerState = Record<
  TopBarSlots,
  {counter: number; element: HTMLElement | null}
>;
type TopBarSlotReducerAction =
  | {
      element: HTMLElement | null;
      name: TopBarSlots;
      type: 'register';
    }
  | {
      name: TopBarSlots;
      type: 'increment counter';
    }
  | {
      name: TopBarSlots;
      type: 'decrement counter';
    };

function topBarSlotReducer(
  state: TopBarSlotReducerState,
  action: TopBarSlotReducerAction
): TopBarSlotReducerState {
  switch (action.type) {
    case 'increment counter':
      return {
        ...state,
        [action.name]: {
          counter: state[action.name].counter + 1,
          element: state[action.name].element,
        },
      };
    case 'decrement counter':
      return {
        ...state,
        [action.name]: {
          counter: state[action.name].counter - 1,
          element: state[action.name].element,
        },
      };
    case 'register':
      return {
        ...state,
        [action.name]: {
          counter: state[action.name]?.counter ?? 0,
          element: action.element,
        },
      };
    default:
      return state;
  }
}

export function TopBarSlotProvider({children}: {children: ReactNode}) {
  const [value, dispatch] = useReducer(topBarSlotReducer, {
    title: {counter: 0, element: null},
    actions: {counter: 0, element: null},
    feedback: {counter: 0, element: null},
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
    <TopBarSlotContext.Provider value={[value, dispatch, registerSlot]}>
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
    const [value, dispatch] = useTopBarSlotContext();
    const hasPageFrame = useHasPageFrameFeature();

    useLayoutEffect(() => {
      dispatch({type: 'increment counter', name});
      return () => {
        dispatch({type: 'decrement counter', name});
      };
    }, [dispatch]);

    // If the organization doesn't have the page frame feature,
    // then render the children in their natural JSX position
    if (!hasPageFrame) {
      return children;
    }

    if (!value[name]?.element) {
      return null;
    }

    return createPortal(children, value[name].element);
  }

  Slot.displayName = `TopBarSlot.${name}`;
  return Slot;
}

export const TopBarSlot = {
  Title: makeSlotOutlet('title'),
  Actions: makeSlotOutlet('actions'),
  Feedback: makeSlotOutlet('feedback'),
};
