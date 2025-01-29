import {useEffect, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

interface Props {
  stream: string;
}

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

export function AutofixOutputStream({stream}: Props) {
  const [displayedText, setDisplayedText] = useState('');
  const previousText = useRef('');
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const newText = stream;

    // Reset animation if the new text is completely different
    if (!newText.startsWith(displayedText)) {
      previousText.current = newText;
      currentIndexRef.current = 0;
      setDisplayedText('');
    }

    const interval = window.setInterval(() => {
      if (currentIndexRef.current < newText.length) {
        setDisplayedText(newText.slice(0, currentIndexRef.current + 1));
        currentIndexRef.current++;
      } else {
        window.clearInterval(interval);
      }
    }, 15);

    return () => {
      window.clearInterval(interval);
    };
  }, [displayedText, stream]);

  return (
    <AnimatePresence mode="wait">
      <Wrapper
        key="output-stream"
        initial={{opacity: 0, height: 0, scale: 0.8}}
        animate={{opacity: 1, height: 'auto', scale: 1}}
        exit={{opacity: 0, height: 0, scale: 0.8, y: -20}}
        transition={testableTransition({
          duration: 1.0,
          height: {
            type: 'spring',
            bounce: 0.2,
          },
          scale: {
            type: 'spring',
            bounce: 0.2,
          },
          y: {
            type: 'tween',
            ease: 'easeOut',
          },
        })}
        style={{
          transformOrigin: 'top center',
        }}
      >
        <StyledArrow direction="down" size="sm" />
        <StreamContainer layout>
          <StreamContent>{displayedText}</StreamContent>
        </StreamContainer>
      </Wrapper>
    </AnimatePresence>
  );
}

const Wrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: ${space(1)} ${space(4)};
  gap: ${space(1)};
  overflow: hidden;
`;

const StreamContainer = styled(motion.div)`
  position: relative;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  border: 1px dashed ${p => p.theme.border};
  height: 5rem;
  overflow: hidden;

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
    animation: ${shimmer} 2s infinite linear;
    pointer-events: none;
  }
`;

const StreamContent = styled('div')`
  margin: 0;
  padding: ${space(2)};
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  height: 5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column-reverse;
`;

const StyledArrow = styled(IconArrow)`
  color: ${p => p.theme.subText};
  opacity: 0.5;
`;
