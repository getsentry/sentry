import {cloneElement, Component} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {StacktraceFilenameQuery} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebug';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {Frame, Organization, PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StackTraceMechanism, StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import withOrganization from 'sentry/utils/withOrganization';

import DeprecatedLine from '../../frame/deprecatedLine';
import {getImageRange, parseAddress, stackTracePlatformIcon} from '../../utils';

import StacktracePlatformIcon from './platformIcon';

type DefaultProps = {
  expandFirstFrame: boolean;
  includeSystemFrames: boolean;
};

type Props = {
  data: StacktraceType;
  event: Event;
  platform: PlatformType;
  className?: string;
  debugFrames?: StacktraceFilenameQuery[];
  hideIcon?: boolean;
  isHoverPreviewed?: boolean;
  lockAddress?: string;
  maxDepth?: number;
  mechanism?: StackTraceMechanism | null;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  organization?: Organization;
  threadId?: number;
} & Partial<DefaultProps>;

type State = {
  showCompleteFunctionName: boolean;
  showingAbsoluteAddresses: boolean;
  toggleFrameMap: {[frameIndex: number]: boolean};
};

class Content extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    includeSystemFrames: true,
    expandFirstFrame: true,
  };

  constructor(props) {
    super(props);
    this.state.toggleFrameMap = this.setInitialFrameMap();
  }

  state: State = {
    showingAbsoluteAddresses: false,
    showCompleteFunctionName: false,
    toggleFrameMap: {},
  };

  setInitialFrameMap(): {[frameIndex: number]: boolean} {
    const {data} = this.props;
    const indexMap = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
      const repeatedFrame = this.isRepeatedFrame(frame, nextFrame);
      if (this.frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
        indexMap[frameIdx] = false;
      }
    });
    return indexMap;
  }

  frameIsVisible = (frame: Frame, nextFrame: Frame) => {
    const {includeSystemFrames} = this.props;

    return (
      includeSystemFrames ||
      frame.inApp ||
      (nextFrame && nextFrame.inApp) ||
      // the last non-app frame
      (!frame.inApp && !nextFrame)
    );
  };

  getInitialFrameCounts(): {[frameIndex: number]: number} {
    const {data} = this.props;
    let count = 0;
    const countMap = {};
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
      const repeatedFrame = this.isRepeatedFrame(frame, nextFrame);
      if (this.frameIsVisible(frame, nextFrame) && !repeatedFrame && !frame.inApp) {
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

  getRepeatedFrameIndices() {
    const {data} = this.props;
    const repeats: number[] = [];
    (data.frames ?? []).forEach((frame, frameIdx) => {
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
      const repeatedFrame = this.isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        repeats.push(frameIdx);
      }
    });
    return repeats;
  }

  getHiddenFrameIndices(
    toggleFrameMap: {[frameIndex: number]: boolean},
    frameCountMap: {[frameIndex: number]: number}
  ) {
    const repeatedIndeces = this.getRepeatedFrameIndices();
    let hiddenFrameIndices: number[] = [];
    Object.keys(toggleFrameMap)
      .filter(frameIndex => toggleFrameMap[frameIndex] === true)
      .forEach(indexString => {
        const index = parseInt(indexString, 10);
        const indicesToBeAdded: number[] = [];
        let i = 1;
        let numHidden = frameCountMap[index];
        while (numHidden > 0) {
          if (!repeatedIndeces.includes(index - i)) {
            indicesToBeAdded.push(index - i);
            numHidden -= 1;
          }
          i += 1;
        }
        hiddenFrameIndices = [...hiddenFrameIndices, ...indicesToBeAdded];
      });
    return hiddenFrameIndices;
  }

  renderOmittedFrames = (firstFrameOmitted, lastFrameOmitted) => {
    const props = {
      className: 'frame frames-omitted',
      key: 'omitted',
    };
    const text = t(
      'Frames %d until %d were omitted and not available.',
      firstFrameOmitted,
      lastFrameOmitted
    );
    return <li {...props}>{text}</li>;
  };

  isFrameAfterLastNonApp(): boolean {
    const {data} = this.props;

    const frames = data.frames ?? [];

    if (!frames.length || frames.length < 2) {
      return false;
    }

    const lastFrame = frames[frames.length - 1];
    const penultimateFrame = frames[frames.length - 2];

    return penultimateFrame.inApp && !lastFrame.inApp;
  }

  isRepeatedFrame(frame: Frame, nextFrame?: Frame): boolean {
    if (!nextFrame) {
      return false;
    }
    return (
      frame.lineNo === nextFrame.lineNo &&
      frame.instructionAddr === nextFrame.instructionAddr &&
      frame.package === nextFrame.package &&
      frame.module === nextFrame.module &&
      frame.function === nextFrame.function
    );
  }

  findImageForAddress(address: Frame['instructionAddr'], addrMode: Frame['addrMode']) {
    const images = this.props.event.entries.find(entry => entry.type === 'debugmeta')
      ?.data?.images;

    return images && address
      ? images.find((img, idx) => {
          if (!addrMode || addrMode === 'abs') {
            const [startAddress, endAddress] = getImageRange(img);
            return address >= (startAddress as any) && address < (endAddress as any);
          }

          return addrMode === `rel:${idx}`;
        })
      : null;
  }

  handleToggleAddresses = (event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation(); // to prevent collapsing if collapsible

    this.setState(prevState => ({
      showingAbsoluteAddresses: !prevState.showingAbsoluteAddresses,
    }));
  };

  handleToggleFunctionName = (event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation(); // to prevent collapsing if collapsible

    this.setState(prevState => ({
      showCompleteFunctionName: !prevState.showCompleteFunctionName,
    }));
  };

  handleToggleFrames = (event: React.MouseEvent<HTMLElement>, frameIndex: number) => {
    event.stopPropagation(); // to prevent toggling frame context

    this.setState(prevState => ({
      toggleFrameMap: {
        ...prevState.toggleFrameMap,
        [frameIndex]: !prevState.toggleFrameMap[frameIndex],
      },
    }));
  };

  getClassName() {
    const {className = '', includeSystemFrames} = this.props;

    if (includeSystemFrames) {
      return `${className} traceback full-traceback`;
    }

    return `${className} traceback in-app-traceback`;
  }

  render() {
    const {
      data,
      event,
      newestFirst,
      expandFirstFrame,
      platform,
      includeSystemFrames,
      isHoverPreviewed,
      maxDepth,
      meta,
      debugFrames,
      hideIcon,
      threadId,
      lockAddress,
    } = this.props;

    const {showingAbsoluteAddresses, showCompleteFunctionName, toggleFrameMap} =
      this.state;

    let firstFrameOmitted = null;
    let lastFrameOmitted = null;

    if (data.framesOmitted) {
      firstFrameOmitted = data.framesOmitted[0];
      lastFrameOmitted = data.framesOmitted[1];
    }

    let lastFrameIdx: number | null = null;

    (data.frames ?? []).forEach((frame, frameIdx) => {
      if (frame.inApp) {
        lastFrameIdx = frameIdx;
      }
    });

    if (lastFrameIdx === null) {
      lastFrameIdx = (data.frames ?? []).length - 1;
    }

    let frames: React.ReactElement[] = [];
    let nRepeats = 0;

    const maxLengthOfAllRelativeAddresses = (data.frames ?? []).reduce(
      (maxLengthUntilThisPoint, frame) => {
        const correspondingImage = this.findImageForAddress(
          frame.instructionAddr,
          frame.addrMode
        );

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

    const frameCountMap = this.getInitialFrameCounts();
    const hiddenFrameIndices: number[] = this.getHiddenFrameIndices(
      toggleFrameMap,
      frameCountMap
    );

    const isFrameAfterLastNonApp = this.isFrameAfterLastNonApp();
    const mechanism =
      platform === 'java' && event.tags?.find(({key}) => key === 'mechanism')?.value;
    const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';

    (data.frames ?? []).forEach((frame, frameIdx) => {
      const prevFrame = (data.frames ?? [])[frameIdx - 1];
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
      const repeatedFrame = this.isRepeatedFrame(frame, nextFrame);

      if (repeatedFrame) {
        nRepeats++;
      }

      if (
        (this.frameIsVisible(frame, nextFrame) && !repeatedFrame) ||
        hiddenFrameIndices.includes(frameIdx)
      ) {
        const image = this.findImageForAddress(frame.instructionAddr, frame.addrMode);
        frames.push(
          <DeprecatedLine
            key={frameIdx}
            event={event}
            data={frame}
            isExpanded={expandFirstFrame && lastFrameIdx === frameIdx}
            emptySourceNotation={lastFrameIdx === frameIdx && frameIdx === 0}
            isOnlyFrame={(data.frames ?? []).length === 1}
            nextFrame={nextFrame}
            prevFrame={prevFrame}
            platform={platform}
            timesRepeated={nRepeats}
            showingAbsoluteAddress={showingAbsoluteAddresses}
            onAddressToggle={this.handleToggleAddresses}
            image={image}
            maxLengthOfRelativeAddress={maxLengthOfAllRelativeAddresses}
            registers={{}} // TODO: Fix registers
            isFrameAfterLastNonApp={isFrameAfterLastNonApp}
            includeSystemFrames={includeSystemFrames}
            onFunctionNameToggle={this.handleToggleFunctionName}
            onShowFramesToggle={e => {
              this.handleToggleFrames(e, frameIdx);
            }}
            isSubFrame={hiddenFrameIndices.includes(frameIdx)}
            isShowFramesToggleExpanded={toggleFrameMap[frameIdx]}
            showCompleteFunctionName={showCompleteFunctionName}
            isHoverPreviewed={isHoverPreviewed}
            frameMeta={meta?.frames?.[frameIdx]}
            registersMeta={meta?.registers}
            debugFrames={debugFrames}
            isANR={isANR}
            threadId={threadId}
            lockAddress={lockAddress}
            hiddenFrameCount={frameCountMap[frameIdx]}
          />
        );
      }

      if (!repeatedFrame) {
        nRepeats = 0;
      }

      if (frameIdx === firstFrameOmitted) {
        frames.push(this.renderOmittedFrames(firstFrameOmitted, lastFrameOmitted));
      }
    });

    if (frames.length > 0 && data.registers) {
      const lastFrame = frames.length - 1;
      frames[lastFrame] = cloneElement(frames[lastFrame], {
        registers: data.registers,
      });
    }

    if (defined(maxDepth)) {
      frames = frames.slice(-maxDepth);
    }

    if (newestFirst) {
      frames.reverse();
    }

    const className = this.getClassName();
    const platformIcon = stackTracePlatformIcon(platform, data.frames ?? []);

    return (
      <Wrapper className={className} data-test-id="stack-trace-content">
        {!hideIcon && <StacktracePlatformIcon platform={platformIcon} />}
        <GuideAnchor target="stack_trace">
          <StyledList data-test-id="frames">{frames}</StyledList>
        </GuideAnchor>
      </Wrapper>
    );
  }
}

export default withOrganization(Content);

const Wrapper = styled(Panel)`
  position: relative;
  border-top-left-radius: 0;
`;

const StyledList = styled('ul')`
  list-style: none;
`;
