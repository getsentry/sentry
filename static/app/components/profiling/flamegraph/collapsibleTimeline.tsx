import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';

interface CollapsibleTimelineProps {
  children: React.ReactNode;
  onClose: () => void;
  onOpen: () => void;
  open: boolean;
  title: string;
}
function CollapsibleTimeline(props: CollapsibleTimelineProps) {
  const theme = useFlamegraphTheme();
  return (
    <Fragment>
      <CollapsibleTimelineHeader
        open={props.open}
        labelHeight={theme.SIZES.TIMELINE_LABEL_HEIGHT}
        border={theme.COLORS.GRID_LINE_COLOR}
      >
        <CollapsibleTimelineLabel>{props.title}</CollapsibleTimelineLabel>
        <StyledButton
          size="xs"
          onClick={props.open ? props.onClose : props.onOpen}
          aria-label={props.open ? t('Expand') : t('Collapse')}
          aria-expanded={props.open}
        >
          <IconChevron size="xs" direction={props.open ? 'up' : 'down'} />
        </StyledButton>
      </CollapsibleTimelineHeader>
      {props.open ? (
        <CollapsibleTimelineContainer labelHeight={theme.SIZES.TIMELINE_LABEL_HEIGHT}>
          {props.children}
        </CollapsibleTimelineContainer>
      ) : null}
    </Fragment>
  );
}

const StyledButton = styled(Button)`
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
`;

export function CollapsibleTimelineLoadingIndicator({size}: {size?: number}) {
  return (
    <CollapsibleTimelineLoadingIndicatorContainer>
      <LoadingIndicator size={size ?? 32} />
    </CollapsibleTimelineLoadingIndicatorContainer>
  );
}

const CollapsibleTimelineContainer = styled('div')<{labelHeight: number}>`
  position: relative;
  width: 100%;
  height: calc(100% - ${p => p.labelHeight}px);
`;

const CollapsibleTimelineLoadingIndicatorContainer = styled('div')`
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
`;

const CollapsibleTimelineHeader = styled('div')<{
  border: string;
  labelHeight: number;
  open: boolean;
}>`
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export const CollapsibleTimelineMessage = styled('p')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  position: absolute;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;
export {CollapsibleTimeline};
