import type {ReactNode} from 'react';
import {isValidElement} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import StructuredEventData from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReplayFrame, WebVitalFrame} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import type {OnExpandCallback} from 'sentry/views/replays/detail/useVirtualizedInspector';

interface Props {
  allowShowSnippet: boolean;
  description: ReactNode;
  frame: ReplayFrame | WebVitalFrame;
  onClickViewHtml: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onInspectorExpanded: OnExpandCallback;
  showSnippet: boolean;
  className?: string;
  expandPaths?: string[];
}

export function BreadcrumbDescription({
  description,
  allowShowSnippet,
  showSnippet,
  frame,
  expandPaths,
  onInspectorExpanded,
  onClickViewHtml,
}: Props) {
  if (
    typeof description === 'string' ||
    (description !== undefined && isValidElement(description))
  ) {
    return (
      <DescriptionWrapper>
        <Description title={description} showOnlyOnOverflow isHoverable>
          {description}
        </Description>

        {allowShowSnippet &&
          !showSnippet &&
          frame.data?.nodeId !== undefined &&
          !isSpanFrame(frame) && (
            <ViewHtmlButton priority="link" onClick={onClickViewHtml} size="xs">
              {t('View HTML')}
            </ViewHtmlButton>
          )}
      </DescriptionWrapper>
    );
  }

  return (
    <Wrapper>
      <StructuredEventData
        initialExpandedPaths={expandPaths ?? []}
        onToggleExpand={(expandedPaths, path) => {
          onInspectorExpanded(
            path,
            Object.fromEntries(expandedPaths.map(item => [item, true]))
          );
        }}
        data={description}
        withAnnotatedText
      />
    </Wrapper>
  );
}

const Description = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
`;

const DescriptionWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: space-between;
`;

const ViewHtmlButton = styled(Button)`
  white-space: nowrap;
`;

const Wrapper = styled('div')`
  pre {
    margin: 0;
  }
`;
