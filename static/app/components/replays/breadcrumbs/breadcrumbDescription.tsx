import type {ReactNode} from 'react';
import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ReplayFrame, WebVitalFrame} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  allowShowSnippet: boolean;
  description: ReactNode;
  frame: ReplayFrame | WebVitalFrame;
  onShowSnippet: () => void;
  showSnippet: boolean;
}

export function BreadcrumbDescription({
  allowShowSnippet,
  description,
  frame,
  onShowSnippet,
  showSnippet,
}: Props) {
  const organization = useOrganization();
  const handleViewHtml = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onShowSnippet();
      e.preventDefault();
      e.stopPropagation();
      trackAnalytics('replay.view-html', {
        organization,
        breadcrumb_type: 'category' in frame ? frame.category : 'unknown',
      });
    },
    [onShowSnippet, organization, frame]
  );

  return (
    <Flex gap="lg" justify="between" align="start">
      <Tooltip title={description} showOnlyOnOverflow isHoverable skipWrapper>
        <Text ellipsis size="xs" tabular variant="muted">
          {description}
        </Text>
      </Tooltip>

      {allowShowSnippet &&
        !showSnippet &&
        frame.data?.nodeId !== undefined &&
        !isSpanFrame(frame) && (
          <NoWrapButton priority="link" onClick={handleViewHtml} size="xs">
            {t('View HTML')}
          </NoWrapButton>
        )}
    </Flex>
  );
}

const NoWrapButton = styled(Button)`
  white-space: nowrap;
`;
