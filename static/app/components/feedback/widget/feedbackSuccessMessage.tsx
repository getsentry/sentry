import React from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

const Wrapper = styled('div')`
  position: fixed;
  width: 100vw;
  padding: 8px;
  right: 0;
  bottom: 0;
  pointer-events: none;
  display: flex;
  justify-content: flex-end;
  transition: transform 0.4s ease-in-out;
  transform: translateY(0);
  z-index: 20000;
  &[data-hide='true'] {
    transform: translateY(120%);
  }
`;

const borderColor = keyframes`
  0% {
    box-shadow: 0 2px 6px rgba(88, 74, 192, 1);
    border-color: rgba(88, 74, 192, 1);
  }
  20% {
    box-shadow: 0 2px 6px #FFC227;
    border-color: #FFC227;
  }
  40% {
    box-shadow: 0 2px 6px #FF7738;
    border-color: #FF7738;
  }
  60% {
    box-shadow: 0 2px 6px #33BF9E;
    border-color: #33BF9E;
  }
  80% {
    box-shadow: 0 2px 6px #F05781;
    border-color: #F05781;
  }
  100% {
    box-shadow: 0 2px 6px rgba(88, 74, 192, 1);
    border-color: rgba(88, 74, 192, 1);
  }
`;

const Content = styled('div')`
  background-color: #fff;
  border: 2px solid rgba(88, 74, 192, 1);
  border-radius: 20px;
  color: rgba(43, 34, 51, 1);
  font-size: 14px;
  padding: 6px 24px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 4px 16px;
  animation: ${borderColor} 4s alternate infinite;
`;

interface FeedbackSuccessMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  show: boolean;
}

export function FeedbackSuccessMessage({show, ...props}: FeedbackSuccessMessageProps) {
  return (
    <Wrapper data-hide={!show} {...props}>
      <Content>🎉 Thank you for your feedback! 🙌</Content>
    </Wrapper>
  );
}
