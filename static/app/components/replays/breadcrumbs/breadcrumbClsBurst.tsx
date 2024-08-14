import {Children, isValidElement, ReactNode, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import useExpandedState, {
  ExpandedStateContextProvider,
} from 'sentry/components/structuredEventData/useExpandedState';
import Timeline from 'sentry/components/timeline';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {explodeSlug} from 'sentry/utils';
import {Extraction} from 'sentry/utils/replays/extractHtml';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useExtractDomNodes from 'sentry/utils/replays/hooks/useExtractDomNodes';
import ReplayReader from 'sentry/utils/replays/replayReader';
import {isWebVitalFrame, ReplayFrame, WebVitalFrame} from 'sentry/utils/replays/types';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/insights/browser/webVitals/utils/performanceScoreColors';
import {Description} from 'sentry/views/traces/fieldRenderers';

type MouseCallback = (frame: ReplayFrame, e: React.MouseEvent<HTMLElement>) => void;

interface Props {
  clsFrame: WebVitalFrame;
  expandPaths: string[] | undefined;
  onInspectorExpanded: (path: string, expandedState: Record<string, boolean>) => void;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
  replay: ReplayReader | null;
}

export function ClsBurst({
  replay,
  clsFrame,
  onInspectorExpanded,
  expandPaths,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const wvFrames = replay
    ?.getCLSFrames()
    .filter(frame => isWebVitalFrame(frame) && frame.timestampMs <= clsFrame.timestampMs);

  const {data: frameToExtraction} = useExtractDomNodes({replay});

  console.log(replay?.getWebVitalFrames(), replay?.getCLSFrames(), wvFrames);

  return Array.isArray(wvFrames) && wvFrames.length ? (
    <ExpandedStateContextProvider
      initialExpandedPaths={() => expandPaths ?? []}
      onToggleExpand={(expandedPaths, path) => {
        onInspectorExpanded(
          path,
          Object.fromEntries(expandedPaths.map(item => [item, true]))
        );
      }}
    >
      <ClsCollapsible path={'$'}>
        {wvFrames.map(vital => {
          return (
            <div key={vital.data.value}>
              <CLSWebVital
                cls={vital}
                frameToExtraction={frameToExtraction}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
              />
            </div>
          );
        })}
      </ClsCollapsible>
    </ExpandedStateContextProvider>
  ) : null;
}

interface ClsProps {
  cls: WebVitalFrame;
  frameToExtraction: Map<ReplayFrame, Extraction> | undefined;
  onMouseEnter: MouseCallback;
  onMouseLeave: MouseCallback;
}

function CLSWebVital({cls, frameToExtraction, onMouseEnter, onMouseLeave}: ClsProps) {
  const {color, description, title, icon} = getFrameDetails(cls);
  return (
    <div
      onMouseEnter={e => onMouseEnter(cls, e)}
      onMouseLeave={e => onMouseLeave(cls, e)}
    >
      <Description>{description}</Description>
      {frameToExtraction?.get(cls)?.html
        ? frameToExtraction?.get(cls)?.html.map(html => (
            <CodeSnippet language="html" hideCopyButton key={html}>
              {beautify.html(html ?? '', {
                indent_size: 2,
              })}
            </CodeSnippet>
          ))
        : null}
    </div>
  );
}

interface CollapsibleProps {
  children: ReactNode;
  path: string;
}

export function ClsCollapsible({children, path}: CollapsibleProps) {
  const {collapse, expand, isExpanded: isInitiallyExpanded} = useExpandedState({path});
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);
  const numChildren = Children.count(children);

  const shouldShowToggleButton = numChildren > 0;
  const isBaseLevel = path === '$';

  // Toggle buttons get placed to the left of the open tag, but if this is the
  // base level there is no room for it. So we add padding in this case.
  const baseLevelPadding = isBaseLevel && shouldShowToggleButton;

  return (
    <CollapsibleDataContainer data-base-with-toggle={baseLevelPadding}>
      {numChildren > 0 ? (
        <ToggleButton
          size="zero"
          aria-label={isExpanded ? t('Collapse') : t('Expand')}
          onClick={() => {
            if (isExpanded) {
              collapse();
              setIsExpanded(false);
            } else {
              expand();
              setIsExpanded(true);
            }
          }}
          icon={
            <IconChevron direction={isExpanded ? 'down' : 'right'} legacySize="10px" />
          }
          borderless
          data-base-with-toggle={baseLevelPadding}
        />
      ) : null}
      <div>{t('View all CLS')}</div>
      {shouldShowToggleButton && isExpanded ? (
        <IndentedValues>{children}</IndentedValues>
      ) : null}
    </CollapsibleDataContainer>
  );
}

function RATING_TO_SCORE(rating) {
  switch (rating) {
    case 'good':
      return 'good';
    case 'needs-improvement':
      return 'needsImprovement';
    case 'poor':
      return 'bad';
    default:
      return 'good';
  }
}

const Score = styled('span')<{status: string}>`
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
`;

const CollapsibleDataContainer = styled('span')`
  position: relative;

  &[data-base-with-toggle='true'] {
    display: block;
    padding-left: ${space(3)};
  }
`;

const IndentedValues = styled('div')`
  padding-left: ${space(1.5)};
`;

const ToggleButton = styled(Button)`
  position: absolute;
  left: -${space(3)};
  top: 2px;
  border-radius: 2px;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;

  &[data-base-with-toggle='true'] {
    left: 0;
  }
`;
