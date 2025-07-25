import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import {IconSeer} from 'sentry/icons';

interface SeerSearchHeaderProps {
  title: string;
  handleExampleClick?: (example: string) => void;
  loading?: boolean;
}

const EXAMPLE_QUERIES = [
  'p95 duration of http client calls',
  'database calls by transaction',
  'POST requests slower than 250ms',
  'failure rate by user in the last week',
];

export function SeerSearchHeader({
  title,
  handleExampleClick,
  loading = false,
}: SeerSearchHeaderProps) {
  const [currentExampleIndex, setCurrentExampleIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentExampleIndex(prevIndex => (prevIndex + 1) % EXAMPLE_QUERIES.length);
        setIsAnimating(false);
      }, 250);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <HeaderWrapper>
      <IconSeer variant={loading ? 'loading' : 'default'} color="purple300" />
      <Text>
        {title}
        {handleExampleClick ? (
          <AnimatedExampleText
            isAnimating={isAnimating}
            size="zero"
            priority="transparent"
            onClick={() => {
              const currentExample = EXAMPLE_QUERIES[currentExampleIndex];
              if (currentExample && handleExampleClick) {
                handleExampleClick(currentExample);
              }
            }}
          >
            {EXAMPLE_QUERIES[currentExampleIndex] || EXAMPLE_QUERIES[0]}
          </AnimatedExampleText>
        ) : null}
      </Text>
    </HeaderWrapper>
  );
}

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  background: ${p => p.theme.purple100};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  width: 100%;
`;

const AnimatedExampleText = styled(Button)<{isAnimating: boolean}>`
  border-radius: ${p => p.theme.borderRadius};
  font-family: ${p => p.theme.text.familyMono};
  white-space: nowrap;
  display: inline-block;
  margin: 0 ${p => p.theme.space.sm};
  cursor: pointer;
  border: 1px solid transparent;
  opacity: ${p => (p.isAnimating ? 0 : 1)};
  transition:
    opacity 0.3s ease-in-out,
    background 0.2s ease-in-out,
    border-color 0.2s ease-in-out;
  background: ${p => p.theme.gray200};

  &:hover {
    background: ${p => p.theme.translucentGray200};
    border-color: ${p => p.theme.border};
  }
`;
