import styled from '@emotion/styled';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {space} from 'sentry/styles/space';

interface Props {
  children: React.ReactNode;
  alignment?: 'left' | 'right';
  description?: React.ReactNode;
  title?: React.ReactNode;
}

export function Block({title, description, alignment = 'right', children}: Props) {
  return (
    <BlockWrapper>
      {title && (
        <BlockTitle alignment={alignment}>
          {title}
          {description && (
            <BlockTooltipContainer>
              <QuestionTooltip size="sm" position="right" title={description} />
            </BlockTooltipContainer>
          )}
        </BlockTitle>
      )}
      <BlockContent alignment={alignment}>{children}</BlockContent>
    </BlockWrapper>
  );
}

export const BlockContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;

const BlockWrapper = styled('div')`
  flex-grow: 1;
  min-width: 0;
  word-break: break-word;
  padding-bottom: ${space(2)};
`;

const BlockTitle = styled('h3')<{alignment: 'left' | 'right'}>`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  white-space: nowrap;
  height: ${space(3)};
  text-align: ${p => p.alignment};
`;

const BlockContent = styled('h4')<{alignment: 'left' | 'right'}>`
  margin: 0;
  font-weight: normal;
  text-align: ${p => p.alignment};
`;

const BlockTooltipContainer = styled('span')`
  margin-left: ${space(1)};
`;
