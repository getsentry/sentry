import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import {space} from 'sentry/styles/space';

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
        <Text>{description}</Text>
      </TextContainer>
    </Fragment>
  );
}

const TextContainer = styled('div')`
  padding: ${space(2)};
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
