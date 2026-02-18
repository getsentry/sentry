import {Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';

const EMPTY_PLACEHOLDER = '\u2014'; // em dash

interface TextWidgetProps {
  description?: string;
}

export function TextWidgetVisualization({description}: TextWidgetProps) {
  if (!description) {
    return (
      <EmptyState>
        <EmptyPlaceholder>{EMPTY_PLACEHOLDER}</EmptyPlaceholder>
      </EmptyState>
    );
  }

  return (
    <Fragment>
      <TextContainer>
        <MarkedText text={description} />
      </TextContainer>
    </Fragment>
  );
}

const TextContainer = styled('div')`
  padding: ${space(2)};
  height: 100%;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const EmptyState = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100px;
`;

const EmptyPlaceholder = styled('span')`
  color: ${p => p.theme.colors.gray400};
  font-size: ${p => p.theme.font.size['4xl']};
`;
