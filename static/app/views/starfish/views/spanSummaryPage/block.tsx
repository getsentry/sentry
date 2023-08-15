import styled from '@emotion/styled';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {space} from 'sentry/styles/space';

interface Props {
  children: React.ReactNode;
  description?: React.ReactNode;
  title?: React.ReactNode;
}

export function Block({title, description, children}: Props) {
  return (
    <BlockWrapper>
      {title && (
        <BlockTitle>
          {title}
          {description && (
            <BlockTooltipContainer>
              <QuestionTooltip size="sm" position="right" title={description} />
            </BlockTooltipContainer>
          )}
        </BlockTitle>
      )}
      <BlockContent>{children}</BlockContent>
    </BlockWrapper>
  );
}

export const BlockContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(2)};
`;

const BlockWrapper = styled('div')`
  flex-grow: 1;
  min-width: 0;
  word-break: break-word;
  padding-bottom: ${space(2)};
`;

const BlockTitle = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  margin-bottom: ${space(1)};
  white-space: nowrap;
  display: flex;
  height: ${space(3)};
`;

const BlockContent = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

const BlockTooltipContainer = styled('span')`
  margin-left: ${space(1)};
`;
