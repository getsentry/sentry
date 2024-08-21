import {cloneElement, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {
  CodeWrapper,
  ContextLineCode,
  ContextLineWrapper,
} from 'sentry/components/events/interfaces/frame/context';
import ContextLineNumber from 'sentry/components/events/interfaces/frame/contextLineNumber';
import {usePrismTokensSourceContext} from 'sentry/components/events/interfaces/frame/usePrismTokensSourceContext';
import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import Panel from 'sentry/components/panels/panel';
import {StructuredData} from 'sentry/components/structuredEventData';
import {IconNext, IconPrevious, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Frame} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import type {StackTraceMechanism, StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {getFileExtension} from 'sentry/utils/fileExtension';
import withOrganization from 'sentry/utils/withOrganization';

import type {DeprecatedLineProps} from '../../frame/deprecatedLine';
import DeprecatedLine from '../../frame/deprecatedLine';
import {
  findImageForAddress,
  getHiddenFrameIndices,
  getLastFrameIndex,
  isRepeatedFrame,
  parseAddress,
  stackTracePlatformIcon,
} from '../../utils';

import StacktracePlatformIcon from './platformIcon';

type DefaultProps = {
  expandFirstFrame: boolean;
  includeSystemFrames: boolean;
};

interface TimeTravelerStep {
  colno: number;
  filename: string;
  line: string;
  lineno: number;
  post_lines: string[];
  pre_lines: string[];
  vars: Record<string, unknown>;
}

type Props = {
  data: StacktraceType;
  event: Event;
  platform: PlatformKey;
  className?: string;
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  hideIcon?: boolean;
  hideSourceMapDebugger?: boolean;
  isHoverPreviewed?: boolean;
  lockAddress?: string;
  maxDepth?: number;
  mechanism?: StackTraceMechanism | null;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  organization?: Organization;
  threadId?: number;
} & Partial<DefaultProps>;

function Content({
  data,
  event,
  className,
  newestFirst,
  expandFirstFrame = true,
  platform,
  includeSystemFrames = true,
  isHoverPreviewed,
  maxDepth,
  meta,
  hideIcon,
  threadId,
  lockAddress,
  organization,
  frameSourceMapDebuggerData,
  hideSourceMapDebugger,
}: Props) {
  const [inTimetravelMode, setInTimetravelMode] = useState(false);
  const [showingAbsoluteAddresses, setShowingAbsoluteAddresses] = useState(false);
  const [showCompleteFunctionName, setShowCompleteFunctionName] = useState(false);
  const [toggleFrameMap, setToggleFrameMap] = useState(setInitialFrameMap());

  const {frames = [], framesOmitted, registers} = data;

  function frameIsVisible(frame: Frame, nextFrame: Frame) {
    return (
      includeSystemFrames ||
      frame.inApp ||
      nextFrame?.inApp ||
      // the last non-app frame
      (!frame.inApp && !nextFrame)
    );
  }

  function setInitialFrameMap(): {[frameIndex: number]: boolean} {
    const indexMap = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      if (frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
        indexMap[frameIdx] = false;
      }
    });
    return indexMap;
  }

  function getInitialFrameCounts(): {[frameIndex: number]: number} {
    let count = 0;
    const countMap = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);
      if (frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
        countMap[frameIdx] = count;
        count = 0;
      } else {
        if (!repeatedFrame && !frame.inApp) {
          count += 1;
        }
      }
    });
    return countMap;
  }

  function isFrameAfterLastNonApp(): boolean {
    if (!frames.length || frames.length < 2) {
      return false;
    }

    const lastFrame = frames[frames.length - 1];
    const penultimateFrame = frames[frames.length - 2];

    return penultimateFrame.inApp && !lastFrame.inApp;
  }

  function handleToggleAddresses(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowingAbsoluteAddresses(oldShowAbsAddresses => !oldShowAbsAddresses);
  }

  function handleToggleFunctionName(mouseEvent: React.MouseEvent<SVGElement>) {
    mouseEvent.stopPropagation(); // to prevent collapsing if collapsible
    setShowCompleteFunctionName(oldShowCompleteName => !oldShowCompleteName);
  }

  const handleToggleFrames = (
    mouseEvent: React.MouseEvent<HTMLElement>,
    frameIndex: number
  ) => {
    mouseEvent.stopPropagation(); // to prevent toggling frame context

    setToggleFrameMap(prevState => ({
      ...prevState,
      [frameIndex]: !prevState[frameIndex],
    }));
  };

  function renderOmittedFrames(firstFrameOmitted: any, lastFrameOmitted: any) {
    const props = {
      className: 'frame frames-omitted',
      key: 'omitted',
    };
    return (
      <li {...props}>
        {t(
          'Frames %d until %d were omitted and not available.',
          firstFrameOmitted,
          lastFrameOmitted
        )}
      </li>
    );
  }

  const firstFrameOmitted = framesOmitted?.[0] ?? null;
  const lastFrameOmitted = framesOmitted?.[1] ?? null;
  const lastFrameIndex = getLastFrameIndex(frames);
  const frameCountMap = getInitialFrameCounts();
  const hiddenFrameIndices: number[] = getHiddenFrameIndices({
    data,
    toggleFrameMap,
    frameCountMap,
  });

  const mechanism =
    platform === 'java' && event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';

  let nRepeats = 0;

  const maxLengthOfAllRelativeAddresses = frames.reduce(
    (maxLengthUntilThisPoint, frame) => {
      const correspondingImage = findImageForAddress({
        event,
        addrMode: frame.addrMode,
        address: frame.instructionAddr,
      });

      try {
        const relativeAddress = (
          parseAddress(frame.instructionAddr) -
          parseAddress(correspondingImage.image_addr)
        ).toString(16);

        return maxLengthUntilThisPoint > relativeAddress.length
          ? maxLengthUntilThisPoint
          : relativeAddress.length;
      } catch {
        return maxLengthUntilThisPoint;
      }
    },
    0
  );

  let convertedFrames = frames
    .map((frame, frameIndex) => {
      const prevFrame = frames[frameIndex - 1];
      const nextFrame = frames[frameIndex + 1];
      const repeatedFrame = isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        nRepeats++;
      }

      if (
        (frameIsVisible(frame, nextFrame) && !repeatedFrame) ||
        hiddenFrameIndices.includes(frameIndex)
      ) {
        const frameProps: Omit<DeprecatedLineProps, 'config'> = {
          event,
          data: frame,
          isExpanded: expandFirstFrame && lastFrameIndex === frameIndex,
          emptySourceNotation: lastFrameIndex === frameIndex && frameIndex === 0,
          isOnlyFrame: (data.frames ?? []).length === 1,
          nextFrame,
          prevFrame,
          platform,
          timesRepeated: nRepeats,
          showingAbsoluteAddress: showingAbsoluteAddresses,
          onAddressToggle: handleToggleAddresses,
          image: findImageForAddress({
            event,
            addrMode: frame.addrMode,
            address: frame.instructionAddr,
          }),
          maxLengthOfRelativeAddress: maxLengthOfAllRelativeAddresses,
          registers: {}, // TODO: Fix registers
          isFrameAfterLastNonApp: isFrameAfterLastNonApp(),
          includeSystemFrames,
          onFunctionNameToggle: handleToggleFunctionName,
          onShowFramesToggle: (e: React.MouseEvent<HTMLElement>) => {
            handleToggleFrames(e, frameIndex);
          },
          isSubFrame: hiddenFrameIndices.includes(frameIndex),
          isShowFramesToggleExpanded: toggleFrameMap[frameIndex],
          showCompleteFunctionName,
          isHoverPreviewed,
          frameMeta: meta?.frames?.[frameIndex],
          registersMeta: meta?.registers,
          isANR,
          threadId,
          lockAddress,
          hiddenFrameCount: frameCountMap[frameIndex],
          organization,
          frameSourceResolutionResults: frameSourceMapDebuggerData?.[frameIndex],
          hideSourceMapDebugger,
        };

        nRepeats = 0;

        if (frameIndex === firstFrameOmitted) {
          return (
            <Fragment key={frameIndex}>
              <DeprecatedLine {...frameProps} />
              {renderOmittedFrames(firstFrameOmitted, lastFrameOmitted)}
            </Fragment>
          );
        }

        return <DeprecatedLine key={frameIndex} {...frameProps} />;
      }

      if (!repeatedFrame) {
        nRepeats = 0;
      }

      if (frameIndex !== firstFrameOmitted) {
        return null;
      }

      return renderOmittedFrames(firstFrameOmitted, lastFrameOmitted);
    })
    .filter(frame => !!frame) as React.ReactElement[];

  if (convertedFrames.length > 0 && registers) {
    const lastFrame = convertedFrames.length - 1;
    convertedFrames[lastFrame] = cloneElement(convertedFrames[lastFrame], {
      registers,
    });
  }

  if (defined(maxDepth)) {
    convertedFrames = convertedFrames.slice(-maxDepth);
  }

  const wrapperClassName = `${!!className && className} traceback ${
    includeSystemFrames ? 'full-traceback' : 'in-app-traceback'
  }`;

  const platformIcon = stackTracePlatformIcon(platform, data.frames ?? []);

  const timetravelSteps:
    | undefined
    | {
        colno: number;
        filename: string;
        line: string;
        lineno: number;
        post_lines: string[];
        pre_lines: string[];
        vars: Record<string, unknown>;

        // @ts-ignore
      }[] = event.contexts.timetravel?.steps;

  return (
    <Fragment>
      {inTimetravelMode && timetravelSteps && (
        <TimeTraveler
          steps={timetravelSteps}
          onBack={() => {
            setInTimetravelMode(false);
          }}
        />
      )}
      {!inTimetravelMode && timetravelSteps && (
        <Fragment>
          <TimeMachineControls>
            <NavButton
              size="xs"
              priority="default"
              onClick={() => {
                setInTimetravelMode(true);
              }}
              icon={<IconTimer size="sm" />}
            >
              Switch To Debugger
            </NavButton>
          </TimeMachineControls>
          <Wrapper>
            {!hideIcon && <StacktracePlatformIcon platform={platformIcon} />}
            <StackTraceContentPanel
              className={wrapperClassName}
              data-test-id="stack-trace-content"
            >
              <GuideAnchor target="stack_trace">
                <StyledList data-test-id="frames">
                  {!newestFirst ? convertedFrames : [...convertedFrames].reverse()}
                </StyledList>
              </GuideAnchor>
            </StackTraceContentPanel>
          </Wrapper>
        </Fragment>
      )}
    </Fragment>
  );
}

function TimeTraveler({steps, onBack}: {steps: TimeTravelerStep[]; onBack?: () => void}) {
  const [timetravelStep, setTimetravelStep] = useState(0);

  const currentStep = steps[timetravelStep];

  const contextLines = [
    ...currentStep.pre_lines.map((preLine, i, arr) => {
      return [currentStep.lineno + 1 - (arr.length - i), preLine];
    }),
    [currentStep.lineno + 1, currentStep.line],
    ...currentStep.post_lines.map((postLine, i) => {
      return [currentStep.lineno + 2 + i, postLine];
    }),
  ] as Array<[number, string]>;

  const fileExtension = getFileExtension(currentStep.filename || '') ?? '';
  const lines = usePrismTokensSourceContext({
    contextLines,
    lineNo: currentStep.lineno,
    fileExtension,
  });

  const prismClassName = fileExtension ? `language-${fileExtension}` : '';

  return (
    <Fragment>
      <TimeTravelerControlsWrapper>
        <NavButton size="xs" priority="default" onClick={onBack}>
          Go back to boring Stack Trace
        </NavButton>
        <TimeTravelerControls>
          Time Travel Controls:
          <TimeTravelerButton
            size="zero"
            priority="default"
            disabled={timetravelStep === 0}
            onClick={() => {
              setTimetravelStep(s => s - 1);
            }}
          >
            <IconPrevious size="xs" />
          </TimeTravelerButton>
          <TimeTravelerButton
            size="zero"
            priority="default"
            disabled={timetravelStep === steps.length - 1}
            onClick={() => {
              setTimetravelStep(s => s + 1);
            }}
          >
            <IconNext size="xs" />
          </TimeTravelerButton>
        </TimeTravelerControls>
      </TimeTravelerControlsWrapper>
      <TimeTravelerContainer>
        <CodeSide>
          <FileName>{currentStep.filename}</FileName>
          <TimeTravelerCodeWrapper className={prismClassName}>
            <pre className={prismClassName}>
              <code className={prismClassName}>
                {lines.map((line, i) => {
                  const contextLine = contextLines[i];
                  const isActive = currentStep.lineno + 1 === contextLine[0];

                  return (
                    <Fragment key={i}>
                      <ContextLineWrapper isActive={isActive} data-test-id="context-line">
                        <ContextLineNumber
                          lineNumber={contextLine[0]}
                          isActive={isActive}
                        />
                        <ContextLineCode>
                          {line.map((token, key) => (
                            <span key={key} className={token.className}>
                              {token.children}
                            </span>
                          ))}
                        </ContextLineCode>
                      </ContextLineWrapper>
                    </Fragment>
                  );
                })}
              </code>
            </pre>
          </TimeTravelerCodeWrapper>
        </CodeSide>
        <TimeTravelerVariablesContainer>
          {Object.entries(currentStep.vars).length === 0 ? (
            <NoLocalVariables>No local variables in scope.</NoLocalVariables>
          ) : null}
          {Object.entries(currentStep.vars).map(([key, value]) => {
            return (
              <Fragment key={key}>
                <span>{key}:</span>
                <StructuredData
                  value={value}
                  maxDefaultDepth={0}
                  meta={{}}
                  withAnnotatedText
                  withOnlyFormattedText
                  forceDefaultExpand
                />
              </Fragment>
            );
          })}
        </TimeTravelerVariablesContainer>
      </TimeTravelerContainer>
    </Fragment>
  );
}

const NavButton = styled(Button)`
  padding: ${space(1)} ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const CodeSide = styled('div')`
  border-right: 1px ${p => 'solid ' + p.theme.border};
  flex-grow: 1;
`;

const NoLocalVariables = styled('span')`
  color: ${p => p.theme.gray400};
`;

const FileName = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px ${p => 'solid ' + p.theme.border};
  font-size: ${p => p.theme.fontSizeSmall};
  display: flex;
  align-items: center;
  padding: ${space(0.75)} 8px;
`;

const TimeTravelerButton = styled(Button)`
  padding: ${space(1)} ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TimeTravelerControls = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  align-items: center;
  display: flex;
  gap: ${space(0.75)};
`;

const TimeMachineControls = styled('div')`
  align-items: center;
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(1)};
  margin-top: ${space(2)};
`;

const TimeTravelerControlsWrapper = styled('div')`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  margin-top: ${space(2)};
`;

const TimeTravelerCodeWrapper = styled(CodeWrapper)``;

const TimeTravelerContainer = styled(Panel)`
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
`;

const TimeTravelerVariablesContainer = styled('div')`
  width: 260px;
  height: 100%;
  overflow-y: auto;
  overflow-x: auto;
  background-color: ${p => p.theme.background};
  padding: ${space(1)} 12px;
  display: grid;
  grid-template-columns: max-content 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
  grid-column-gap: 8px;
  grid-row-gap: 2px;
  font-family: ${p => p.theme.text.familyMono};
`;

const Wrapper = styled('div')`
  position: relative;
`;

export const StackTraceContentPanel = styled(Panel)`
  position: relative;
  border-top-left-radius: 0;
  overflow: hidden;
`;

const StyledList = styled('ul')`
  list-style: none;
`;

export default withOrganization(Content);
