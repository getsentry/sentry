import styled from '@emotion/styled';

import {
  StacktraceFilenameQuery,
  useSourceMapDebug,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebug';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Frame} from 'sentry/types';
import {defined} from 'sentry/utils';

import DefaultTitle from '../defaultTitle';

import Expander from './expander';
import LeadHint from './leadHint';
import Wrapper from './wrapper';

type Props = React.ComponentProps<typeof Expander> &
  React.ComponentProps<typeof LeadHint> & {
    frame: Frame;
    isUsedForGrouping: boolean;
    debugFrames?: StacktraceFilenameQuery[];
    frameMeta?: Record<any, any>;
    onClick?: () => void;
    onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
    timesRepeated?: number;
  };

const Default = ({
  frame,
  debugFrames,
  nextFrame,
  isHoverPreviewed,
  isExpanded,
  platform,
  timesRepeated,
  isUsedForGrouping,
  leadsToApp,
  onMouseDown,
  onClick,
  frameMeta,
  event,
  ...props
}: Props) => {
  const debugFrame = debugFrames?.find(debug => debug.filename === frame.filename);
  const {data} = useSourceMapDebug(debugFrame?.query, {
    enabled: !!debugFrame,
  });

  function renderRepeats() {
    if (defined(timesRepeated) && timesRepeated > 0) {
      return (
        <RepeatedFrames
          title={tn('Frame repeated %s time', 'Frame repeated %s times', timesRepeated)}
        >
          <RepeatedContent>
            <StyledIconRefresh />
            <span>{timesRepeated}</span>
          </RepeatedContent>
        </RepeatedFrames>
      );
    }

    return null;
  }

  return (
    <Wrapper className="title" onMouseDown={onMouseDown} onClick={onClick}>
      <VertCenterWrapper>
        <Title>
          {data?.errors?.length ? (
            <Tooltip skipWrapper title={t('Missing source map')}>
              <StyledIconWarning
                color="red400"
                size="sm"
                aria-label={t('Missing source map')}
              />
            </Tooltip>
          ) : null}
          <LeadHint
            event={event}
            isExpanded={isExpanded}
            nextFrame={nextFrame}
            leadsToApp={leadsToApp}
          />
          <DefaultTitle
            frame={frame}
            platform={platform}
            isHoverPreviewed={isHoverPreviewed}
            isUsedForGrouping={isUsedForGrouping}
            meta={frameMeta}
          />
        </Title>
        {renderRepeats()}
      </VertCenterWrapper>
      <Expander
        isExpanded={isExpanded}
        isHoverPreviewed={isHoverPreviewed}
        platform={platform}
        {...props}
      />
    </Wrapper>
  );
};

export default Default;

const StyledIconWarning = styled(IconWarning)`
  margin-right: ${space(1)};
`;

const VertCenterWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const Title = styled('div')`
  > * {
    vertical-align: middle;
    line-height: 1;
  }
`;

const RepeatedContent = styled(VertCenterWrapper)`
  justify-content: center;
  margin-right: ${space(1)};
`;

const RepeatedFrames = styled('div')`
  display: inline-block;
  border-radius: 50px;
  padding: 1px 3px;
  margin-left: ${space(1)};
  border-width: thin;
  border-style: solid;
  border-color: ${p => p.theme.pink200};
  color: ${p => p.theme.pink400};
  background-color: ${p => p.theme.backgroundSecondary};
  white-space: nowrap;
`;

const StyledIconRefresh = styled(IconRefresh)`
  margin-right: ${space(0.25)};
`;
