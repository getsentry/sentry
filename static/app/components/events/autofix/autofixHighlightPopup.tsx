import {useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {SeerIcon} from 'sentry/components/ai/SeerIcon';
import {Button} from 'sentry/components/button';
import {useUpdateInsightCard} from 'sentry/components/events/autofix/autofixInsightCards';
import Input from 'sentry/components/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

interface Props {
  groupId: string;
  referenceElement: HTMLElement | null;
  retainInsightCardIndex: number | null;
  runId: string;
  selectedText: string;
  stepIndex: number;
}

function AutofixHighlightPopup({
  selectedText,
  groupId,
  runId,
  stepIndex,
  retainInsightCardIndex,
  referenceElement,
}: Props) {
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});
  const [comment, setComment] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left: 0, top: 0});

  const truncatedText =
    selectedText.length > 70
      ? selectedText.slice(0, 35).split(' ').slice(0, -1).join(' ') +
        '... ...' +
        selectedText.slice(-35)
      : selectedText;

  useLayoutEffect(() => {
    if (!referenceElement || !popupRef.current) {
      return;
    }

    const updatePosition = () => {
      const rect = referenceElement.getBoundingClientRect();
      setPosition({
        left: rect.left - 320,
        top: rect.top,
      });
    };

    // Initial position
    updatePosition();

    // Create observer to track reference element changes
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(referenceElement);

    // Track scroll events
    const scrollElements = [window, ...getScrollParents(referenceElement)];
    scrollElements.forEach(element => {
      element.addEventListener('scroll', updatePosition, {passive: true});
    });
  }, [referenceElement]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      return;
    }
    updateInsight({
      message: comment,
      step_index: stepIndex,
      retain_insight_card_index: retainInsightCardIndex,
    });
    setComment('');
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <Wrapper
      ref={popupRef}
      id="autofix-rethink-input"
      data-popup="autofix-highlight"
      initial={{opacity: 0, x: -10}}
      animate={{opacity: 1, x: 0}}
      exit={{opacity: 0, x: -10}}
      transition={testableTransition({
        duration: 0.2,
      })}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: 'none',
      }}
      onClick={handleContainerClick}
    >
      <Arrow />
      <ScaleContainer>
        <Container onClick={handleContainerClick}>
          <Header>
            <StyledSeerIcon size="md" />
            <SelectedText>
              <span>"{truncatedText}"</span>
            </SelectedText>
          </Header>
          <InputWrapper onSubmit={handleSubmit}>
            <StyledInput
              placeholder={t('Questions or comments?')}
              value={comment}
              onChange={e => setComment(e.target.value)}
              size="sm"
              autoFocus
            />
            <StyledButton size="sm" type="submit" borderless>
              {t('>')}
            </StyledButton>
          </InputWrapper>
        </Container>
      </ScaleContainer>
    </Wrapper>,
    document.body
  );
}

const Wrapper = styled(motion.div)`
  z-index: ${p => p.theme.zIndex.tooltip};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-right: ${space(1)};
  gap: ${space(1)};
  width: 300px;
  position: fixed;
  will-change: transform;
`;

const ScaleContainer = styled(motion.div)`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform-origin: top left;
  padding-left: ${space(2)};
`;

const Container = styled(motion.div)`
  position: relative;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  border: 1px dashed ${p => p.theme.border};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      ${p => p.theme.active}20,
      transparent
    );
    background-size: 2000px 100%;
    pointer-events: none;
  }
`;

const InputWrapper = styled('form')`
  display: flex;
  gap: ${space(0.25)};
  padding: ${space(0.25)} ${space(0.25)};
  background: ${p => p.theme.backgroundSecondary};
`;

const StyledInput = styled(Input)`
  flex-grow: 1;
  background: ${p => p.theme.background}
    linear-gradient(to left, ${p => p.theme.background}, ${p => p.theme.pink400}20);
  border-color: ${p => p.theme.innerBorder};

  &:hover {
    border-color: ${p => p.theme.border};
  }
`;

const StyledButton = styled(Button)`
  flex-shrink: 0;
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(1)};
  background: ${p => p.theme.backgroundSecondary};
`;

const StyledSeerIcon = styled(SeerIcon)`
  flex-shrink: 0;
`;

const SelectedText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;

  span {
    overflow: wrap;
    white-space: wrap;
  }
`;

const Arrow = styled('div')`
  position: absolute;
  width: 12px;
  height: 12px;
  background: ${p => p.theme.active}10;
  border: 1px dashed ${p => p.theme.border};
  border-right: none;
  border-bottom: none;
  top: 20px;
  right: -6px;
  transform: rotate(135deg);
  box-shadow: ${p => p.theme.dropShadowLight};
`;

function getScrollParents(element: HTMLElement): Element[] {
  const scrollParents: Element[] = [];
  let currentElement = element.parentElement;

  while (currentElement) {
    const overflow = window.getComputedStyle(currentElement).overflow;
    if (overflow.includes('scroll') || overflow.includes('auto')) {
      scrollParents.push(currentElement);
    }
    currentElement = currentElement.parentElement;
  }

  return scrollParents;
}

export default AutofixHighlightPopup;
