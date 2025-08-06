import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {withChonk} from 'sentry/utils/theme/withChonk';

interface CollapsibleTimelineProps {
  children: React.ReactNode;
  onClose: () => void;
  onOpen: () => void;
  open: boolean;
  title: string;
}
function CollapsibleTimeline(props: CollapsibleTimelineProps) {
  const theme = useTheme();
  const flamegraphTheme = useFlamegraphTheme();
  return (
    <Fragment>
      <CollapsibleTimelineHeaderWrapper
        open={props.open}
        labelHeight={flamegraphTheme.SIZES.TIMELINE_LABEL_HEIGHT}
        border={flamegraphTheme.COLORS.GRID_LINE_COLOR}
      >
        <Flex justify="between" align="center" height="100%">
          <CollapsibleTimelineLabel>{props.title}</CollapsibleTimelineLabel>
          <StyledButtonWrapper
            priority={theme.isChonk ? 'transparent' : undefined}
            onClick={props.open ? props.onClose : props.onOpen}
            aria-label={props.open ? t('Expand') : t('Collapse')}
            aria-expanded={props.open}
            size="zero"
          >
            <Flex align="center" justify="center">
              <IconChevron size="xs" direction={props.open ? 'up' : 'down'} />
            </Flex>
          </StyledButtonWrapper>
        </Flex>
      </CollapsibleTimelineHeaderWrapper>
      {props.open ? (
        <CollapsibleTimelineContainer
          labelHeight={flamegraphTheme.SIZES.TIMELINE_LABEL_HEIGHT}
        >
          {props.children}
        </CollapsibleTimelineContainer>
      ) : null}
    </Fragment>
  );
}

const StyledButtonWrapper = withChonk(
  styled(Button)`
    height: 12px;
    min-height: 12px;
    padding: ${space(0.25)} ${space(0.5)};
    border-radius: 2px;
    background-color: ${p => p.theme.backgroundSecondary};
    border: none;
    box-shadow: none;
    color: ${p => p.theme.subText};

    &[aria-expanded='true'] {
      color: ${p => p.theme.subText};
    }

    > span:first-child {
      display: none;
    }

    svg {
      transition: none;
    }
  `,
  Button
);

export function CollapsibleTimelineLoadingIndicator({size}: {size?: number}) {
  return (
    <CollapsibleTimelineLoadingIndicatorWrapper>
      <Flex direction="column" justify="center" width="100%" height="100%">
        <LoadingIndicator size={size ?? 32} />
      </Flex>
    </CollapsibleTimelineLoadingIndicatorWrapper>
  );
}

const CollapsibleTimelineContainer = styled('div')<{labelHeight: number}>`
  position: relative;
  width: 100%;
  height: calc(100% - ${p => p.labelHeight}px);
`;

const CollapsibleTimelineLoadingIndicatorWrapper = styled('div')`
  position: absolute;
`;

const CollapsibleTimelineHeaderWrapper = styled('div')<{
  border: string;
  labelHeight: number;
  open: boolean;
}>`
  position: relative;
  z-index: 1;
  height: ${p => p.labelHeight}px;
  min-height: ${p => p.labelHeight}px;
  border-top: 1px solid ${p => p.border};
  border-bottom: 1px solid ${p => (p.open ? p.border : 'transparent')};
  background-color: ${p => p.theme.backgroundSecondary};
`;

export const CollapsibleTimelineLabel = styled('span')`
  padding: 1px ${space(1)};
  font-size: ${p => p.theme.fontSize.xs};
`;

const CollapsibleTimelineMessageWrapper = styled('p')`
  height: 100%;
  width: 100%;
  position: absolute;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

export function CollapsibleTimelineMessage({children}: {children: React.ReactNode}) {
  return (
    <CollapsibleTimelineMessageWrapper>
      <Flex direction="column" justify="center" align="center" height="100%" width="100%">
        {children}
      </Flex>
    </CollapsibleTimelineMessageWrapper>
  );
}
export {CollapsibleTimeline};
