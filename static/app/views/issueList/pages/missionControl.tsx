import {useCallback, useEffect, useRef, useState} from 'react';
import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {IconClose} from 'sentry/icons/iconClose';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {CardPrimaryAction, MissionControlCard} from 'sentry/types/missionControl';
import {useNavigate} from 'sentry/utils/useNavigate';

import {getCardRenderer} from './missionControl/cardRenderers';
import HomeScreen from './missionControl/homeScreen';

// Hardcoded example changelog cards for demo
const EXAMPLE_CARDS: MissionControlCard[] = [
  // {
  //   id: '1',
  //   type: 'changelog',
  //   createdAt: '2024-01-15T10:00:00Z',
  //   priority: 10,
  //   url: 'https://blog.sentry.io/performance-monitoring-2-0/',
  //   data: {
  //     id: '1',
  //     title: 'Trigger alerts and build dashboards for Logs (in beta)',
  //     message:
  //       "We've completely rebuilt our performance monitoring system with better insights, faster loading times, and more detailed transaction traces.",
  //     link: 'https://blog.sentry.io/performance-monitoring-2-0/',
  //     cta: 'Read More',
  //     category: 'feature',
  //     dateCreated: '2025-08-15T10:00:00Z',
  //     dateExpires: '2025-08-15T10:00:00Z',
  //     hasSeen: false,
  //     isActive: true,
  //     mediaUrl:
  //       'https://storage.googleapis.com/sentry-docs-changelog/HhKDUPE-Screenshot%202025-07-23%20at%204.30.03%E2%80%AFPM.png',
  //   },
  //   metadata: {
  //     source: 'hardcoded-demo',
  //     tags: ['feature'],
  //   },
  // },
  {
    id: '4',
    type: 'issue',
    createdAt: '2024-01-20T16:45:00Z',
    priority: 15,
    url: '/issues/6564458657/?seerDrawer=true',
    data: {
      issueId: '6564458657',
      reason: 'escalating',
    },
    metadata: {
      source: 'hardcoded-demo',
      tags: ['error'],
    },
  },
  {
    id: '9',
    type: 'issue',
    createdAt: '2024-01-21T12:30:00Z',
    priority: 14,
    url: '/issues/6678410850/?seerDrawer=true',
    data: {
      issueId: '6678410850',
      reason: 'new',
    },
    metadata: {
      source: 'hardcoded-demo',
      tags: ['error'],
    },
  },
  {
    id: '7',
    type: 'missing-instrumentation',
    createdAt: '2024-01-22T14:30:00Z',
    priority: 11,
    data: {
      purpose:
        'Improve observability for the fixability endpoint to better track intermittent failures when called from Seer Scanner.',
      observability_requests: [
        {
          description:
            'Add detailed tracing spans around the ML model inference pipeline to track processing time and identify bottlenecks in the fixability assessment workflow.',
          instrument_type: 'tracing',
          location:
            'getsentry/seer/src/seer/automation/fixpoint/api.py in the process_fixability_request function',
        },
        {
          description:
            'Implement profiling to identify memory usage patterns and CPU hotspots during model loading and inference phases.',
          instrument_type: 'profiling',
          location:
            'getsentry/seer/src/seer/automation/models/ module, specifically in model initialization and prediction methods',
        },
        {
          description:
            'Add structured logging with correlation IDs to track requests through the entire pipeline and capture error context.',
          instrument_type: 'logging',
          location:
            'getsentry/seer/src/seer/automation/fixpoint/api.py throughout the request lifecycle',
        },
        {
          description:
            'Tag requests with metadata like model version, request size, and processing mode to enable better filtering and analysis.',
          instrument_type: 'tagging',
          location:
            'getsentry/seer/src/seer/automation/fixpoint/api.py at the entry point of each request handler',
        },
      ],
      sourceIssueId: '6678410850',
    },
    url: '/issues/6678410850/?seerDrawer=true',
    metadata: {
      source: 'hardcoded-demo',
      tags: ['instrumentation', 'setup'],
    },
  },
  {
    id: '8',
    type: 'ultragroup',
    createdAt: '2024-01-23T10:15:00Z',
    priority: 13,
    data: {
      title: 'Bad GitHub branch state issues',
      description:
        'These issues are all caused by a bad GitHub branch state in automation agents within Seer, such as Autofix and Bug Predictor.',
      issueIds: [6559383058, 6770107969, 6275476616, 6723171750, 6723094719],
    },
    metadata: {
      source: 'hardcoded-demo',
      tags: ['error-cluster', 'high-priority'],
    },
  },
];

function MissionControl() {
  const navigate = useNavigate();
  const user = ConfigStore.get('user');
  const userName = user?.name || user?.email || 'there';

  // View state management
  const [currentView, setCurrentView] = useState<'home' | 'cards'>('home');

  // Create welcome card if there are items in the queue
  const welcomeCard: MissionControlCard | null =
    EXAMPLE_CARDS.length > 0
      ? {
          id: 'welcome',
          type: 'welcome',
          createdAt: new Date().toISOString(),
          priority: 1000, // Highest priority to appear first
          data: {
            userName,
            totalItems: EXAMPLE_CARDS.length,
          },
          metadata: {
            source: 'system-generated',
            tags: ['welcome'],
          },
        }
      : null;

  // Combine welcome card with example cards
  const [cards, setCards] = useState<MissionControlCard[]>(
    welcomeCard ? [welcomeCard, ...EXAMPLE_CARDS] : []
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [primaryAction, setPrimaryAction] = useState<CardPrimaryAction | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [dismissDirection, setDismissDirection] = useState<
    'left' | 'right' | 'up' | 'down' | null
  >(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentCard: MissionControlCard | null = cards[currentIndex] || null;
  const nextCard: MissionControlCard | null = cards[currentIndex + 1] || null;

  const handleOpenCards = useCallback(() => {
    setCurrentView('cards');
  }, []);

  const handleBackToHome = useCallback(() => {
    setCurrentView('home');
  }, []);

  const handleDismiss = useCallback(() => {
    if (dismissDirection || !currentCard || isTransitioning) return;

    setDismissDirection('left');
    setIsTransitioning(true);

    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setDismissDirection(null);
      setPrimaryAction(null);
      // Allow a brief moment for the next card to transition into place
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  }, [currentCard, dismissDirection, isTransitioning]);

  const handlePrimaryAction = useCallback(async () => {
    if (!primaryAction || isActionLoading || !currentCard || isTransitioning) return;

    setIsActionLoading(true);
    try {
      await primaryAction.handler(currentCard);

      // Dismiss to the right after successful action
      setDismissDirection('right');
      setIsTransitioning(true);

      // Clear any existing timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      animationTimeoutRef.current = setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setDismissDirection(null);
        setPrimaryAction(null);
        // Allow a brief moment for the next card to transition into place
        setTimeout(() => setIsTransitioning(false), 50);
      }, 300);
    } finally {
      setIsActionLoading(false);
    }
  }, [primaryAction, isActionLoading, currentCard, isTransitioning]);

  const handleSetPrimaryAction = useCallback((action: CardPrimaryAction | null) => {
    setPrimaryAction(action);
  }, []);

  const handleMoveToBack = useCallback(() => {
    if (!currentCard || isTransitioning || currentCard.type === 'welcome') return;

    setIsTransitioning(true);
    setDismissDirection('up');

    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = setTimeout(() => {
      setCards(prevCards => {
        const newCards = [...prevCards];
        const cardToMove = newCards[currentIndex];
        if (cardToMove) {
          // Remove from current position and add to end
          newCards.splice(currentIndex, 1);
          newCards.push(cardToMove);
        }
        return newCards;
      });

      // Don't increment currentIndex since we removed the current card
      setDismissDirection(null);
      setPrimaryAction(null);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  }, [currentCard, currentIndex, isTransitioning]);

  const handleNavigate = useCallback(() => {
    if (!currentCard?.url || isTransitioning) return;

    setIsTransitioning(true);
    setDismissDirection('down');

    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Open URL in new tab for external links, navigate internally for relative URLs
    if (currentCard.url.startsWith('http')) {
      window.open(currentCard.url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(currentCard.url);
    }

    animationTimeoutRef.current = setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setDismissDirection(null);
      setPrimaryAction(null);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  }, [currentCard, isTransitioning, navigate]);

  // Keyboard hotkey support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys if user is typing in an input
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return;
      }

      if (!isActionLoading && !isTransitioning) {
        switch (event.key) {
          case 'Escape':
            event.preventDefault();
            handleBackToHome();
            break;
          case 'Enter':
            if (event.shiftKey) {
              // Shift + Enter = view full details
              if (currentCard?.url) {
                event.preventDefault();
                handleNavigate();
              }
            } else {
              // Enter = act (primary action)
              if (primaryAction) {
                event.preventDefault();
                handlePrimaryAction();
              }
            }
            break;
          case 'Backspace':
            if (event.shiftKey) {
              // Shift + Backspace = move to back
              if (currentCard && currentCard.type !== 'welcome') {
                event.preventDefault();
                handleMoveToBack();
              }
            } else {
              // Backspace = dismiss
              event.preventDefault();
              handleDismiss();
            }
            break;
          default:
            // Do nothing for other keys
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    handleBackToHome,
    handlePrimaryAction,
    handleDismiss,
    handleMoveToBack,
    handleNavigate,
    primaryAction,
    currentCard,
    isActionLoading,
    isTransitioning,
  ]);

  // Go directly back to home when all cards are done
  if (currentView === 'cards' && currentIndex >= cards.length) {
    setCurrentIndex(0);
    setPrimaryAction(null);
    setCurrentView('home');
  }

  // Render home screen
  if (currentView === 'home') {
    return (
      <PageFiltersContainer>
        <HomeScreenContainer>
          <HomeScreen cards={EXAMPLE_CARDS} onOpenCards={handleOpenCards} />
        </HomeScreenContainer>
      </PageFiltersContainer>
    );
  }

  const CardRenderer = currentCard ? getCardRenderer(currentCard.type) : null;
  const NextCardRenderer = nextCard ? getCardRenderer(nextCard.type) : null;

  return (
    <PageFiltersContainer>
      <Container>
        <CloseButtonContainer>
          <CloseButton
            size="sm"
            borderless
            icon={<IconClose />}
            aria-label="Back to home"
            onClick={handleBackToHome}
          />
        </CloseButtonContainer>
        <CardStack>
          {/* Fixed container for next card */}
          <CardContainer
            key="next-card-container"
            isNext={!!nextCard}
            isTransitioning={isTransitioning}
            style={{display: nextCard ? 'block' : 'none'}}
          >
            {nextCard && NextCardRenderer && (
              <NextCardRenderer card={nextCard} onSetPrimaryAction={() => {}} />
            )}
          </CardContainer>

          {/* Fixed container for current card */}
          <CardContainer
            key="current-card-container"
            isCurrent={!!currentCard}
            isTransitioning={isTransitioning}
            dismissDirection={dismissDirection}
            style={{display: currentCard ? 'block' : 'none'}}
          >
            {currentCard && CardRenderer && (
              <CardRenderer
                card={currentCard}
                onSetPrimaryAction={handleSetPrimaryAction}
              />
            )}
          </CardContainer>
        </CardStack>

        <ButtonContainer>
          <Button
            size="md"
            onClick={handleDismiss}
            disabled={isActionLoading || dismissDirection !== null}
          >
            Dismiss
            <KeyHint>⌫</KeyHint>
          </Button>

          <Button
            size="md"
            onClick={handleMoveToBack}
            disabled={
              !currentCard ||
              currentCard.type === 'welcome' ||
              isActionLoading ||
              dismissDirection !== null
            }
          >
            Move to back
            <KeyHint>⇧+⌫</KeyHint>
          </Button>

          <Button
            size="md"
            onClick={handleNavigate}
            disabled={!currentCard?.url || isActionLoading || dismissDirection !== null}
          >
            View full details
            <KeyHint>⇧+↵</KeyHint>
          </Button>

          <Button
            size="md"
            priority="primary"
            onClick={handlePrimaryAction}
            disabled={!primaryAction || isActionLoading || dismissDirection !== null}
            busy={isActionLoading}
          >
            {primaryAction
              ? isActionLoading && primaryAction.loadingLabel
                ? primaryAction.loadingLabel
                : primaryAction.label
              : 'No Action'}
            <KeyHint>↵</KeyHint>
          </Button>
        </ButtonContainer>
      </Container>
    </PageFiltersContainer>
  );
}

const slideLeft = keyframes`
  from {
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
  to {
    transform: translateX(-100vw) rotate(-10deg);
    opacity: 0;
  }
`;

const slideRight = keyframes`
  from {
    transform: translateX(0) rotate(0deg);
    opacity: 1;
  }
  to {
    transform: translateX(100vw) rotate(10deg);
    opacity: 0;
  }
`;

const slideUp = keyframes`
  from {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  to {
    transform: translateY(-100vh) rotate(-5deg);
    opacity: 0;
  }
`;

const slideDown = keyframes`
  from {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  to {
    transform: translateY(100vh) rotate(5deg);
    opacity: 0;
  }
`;

const transitionToCurrent = keyframes`
  from {
    transform: rotate(3deg);
  }
  to {
    transform: rotate(0deg);
  }
`;

const Container = styled('div')`
  padding: ${space(4)};
  height: 100vh;
  display: flex;
  flex-direction: column;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
`;

const HomeScreenContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 100%;
`;

const CardStack = styled('div')`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CardContainer = styled('div')<{
  dismissDirection?: 'left' | 'right' | 'up' | 'down' | null;
  isCurrent?: boolean;
  isNext?: boolean;
  isTransitioning?: boolean;
}>`
  position: absolute;
  width: 100%;
  height: 100%;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  transition:
    transform 0.3s ease-in-out,
    opacity 0.3s ease-in-out;

  ${p =>
    p.isNext &&
    css`
      transform: rotate(3deg);
      z-index: 1;
    `}

  ${p =>
    p.isCurrent &&
    css`
      z-index: 2;

      /* When transitioning and newly current, start from "next" position */
      ${p.isTransitioning &&
      css`
        transform: rotate(3deg);
        /* Give it a moment then transition to current position */
        animation: ${transitionToCurrent} 0.3s ease-in-out 0.1s forwards;
      `}

      ${p.dismissDirection === 'left' &&
      css`
        animation: ${slideLeft} 0.3s ease-in-out forwards;
      `}

      ${p.dismissDirection === 'right' &&
      css`
        animation: ${slideRight} 0.3s ease-in-out forwards;
      `}

      ${p.dismissDirection === 'up' &&
      css`
        animation: ${slideUp} 0.3s ease-in-out forwards;
      `}

      ${p.dismissDirection === 'down' &&
      css`
        animation: ${slideDown} 0.3s ease-in-out forwards;
      `}
    `}
`;

const ButtonContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  justify-content: center;
  margin-top: ${space(1)};
  padding-top: ${space(3)};
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: ${space(1)};
  }
`;

const KeyHint = styled('span')`
  margin-left: ${space(1)};
  opacity: 0.6;
  font-size: 0.8em;
`;

const CloseButtonContainer = styled('div')`
  position: absolute;
  top: ${space(3)};
  right: ${space(3)};
  z-index: 10;
`;

const CloseButton = styled(Button)`
  color: ${p => p.theme.textColor};
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default MissionControl;
