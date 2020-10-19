import React from 'react';
import styled from '@emotion/styled';
import PlatformIcon from 'platformicons';

import Line from 'app/components/events/interfaces/frame/line';
import {t} from 'app/locale';
import {parseAddress, getImageRange} from 'app/components/events/interfaces/utils';
import {StacktraceType} from 'app/types/stacktrace';
import {PlatformType, Event, Frame} from 'app/types';

const defaultProps = {
  includeSystemFrames: true,
  expandFirstFrame: true,
};

type Props = {
  data: StacktraceType;
  platform: PlatformType;
  event: Event;
  newestFirst?: boolean;
  className?: string;
} & typeof defaultProps;

type State = {
  showingAbsoluteAddresses: boolean;
};

export default class StacktraceContent extends React.Component<Props, State> {
  static defaultProps = {
    includeSystemFrames: true,
    expandFirstFrame: true,
  };

  state: State = {
    showingAbsoluteAddresses: false,
  };

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

    const frames = data.frames;

    if (!frames.length || frames.length < 2) {
      return false;
    }

    const lastFrame = frames[frames.length - 1];
    const penultimateFrame = frames[frames.length - 2];

    return penultimateFrame.inApp && !lastFrame.inApp;
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

  findImageForAddress(address: Frame['instructionAddr']) {
    const images = this.props.event.entries.find(entry => entry.type === 'debugmeta')
      ?.data?.images;

    return images && address
      ? images.find(img => {
          const [startAddress, endAddress] = getImageRange(img);
          return address >= startAddress && address < endAddress;
        })
      : null;
  }

  handleToggleAddresses = (event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation(); // to prevent collapsing if collapsable

    this.setState(prevState => ({
      showingAbsoluteAddresses: !prevState.showingAbsoluteAddresses,
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
      newestFirst,
      expandFirstFrame,
      platform,
      includeSystemFrames,
    } = this.props;
    const {showingAbsoluteAddresses} = this.state;

    let firstFrameOmitted = null;
    let lastFrameOmitted = null;

    if (data.framesOmitted) {
      firstFrameOmitted = data.framesOmitted[0];
      lastFrameOmitted = data.framesOmitted[1];
    }

    let lastFrameIdx: number | null = null;

    data.frames.forEach((frame, frameIdx) => {
      if (frame.inApp) {
        lastFrameIdx = frameIdx;
      }
    });

    if (lastFrameIdx === null) {
      lastFrameIdx = data.frames.length - 1;
    }

    const frames: React.ReactElement[] = [];
    let nRepeats = 0;

    const maxLengthOfAllRelativeAddresses = data.frames.reduce(
      (maxLengthUntilThisPoint, frame) => {
        const correspondingImage = this.findImageForAddress(frame.instructionAddr);

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

    const isFrameAfterLastNonApp = this.isFrameAfterLastNonApp();

    data.frames.forEach((frame, frameIdx) => {
      const prevFrame = data.frames[frameIdx - 1];
      const nextFrame = data.frames[frameIdx + 1];
      const repeatedFrame =
        nextFrame &&
        frame.lineNo === nextFrame.lineNo &&
        frame.instructionAddr === nextFrame.instructionAddr &&
        frame.package === nextFrame.package &&
        frame.module === nextFrame.module &&
        frame.function === nextFrame.function;

      if (repeatedFrame) {
        nRepeats++;
      }

      if (this.frameIsVisible(frame, nextFrame) && !repeatedFrame) {
        const image = this.findImageForAddress(frame.instructionAddr);

        frames.push(
          <Line
            key={frameIdx}
            data={frame}
            isExpanded={expandFirstFrame && lastFrameIdx === frameIdx}
            emptySourceNotation={lastFrameIdx === frameIdx && frameIdx === 0}
            isOnlyFrame={data.frames.length === 1}
            nextFrame={nextFrame}
            prevFrame={prevFrame}
            platform={platform}
            timesRepeated={nRepeats}
            showingAbsoluteAddress={showingAbsoluteAddresses}
            onAddressToggle={this.handleToggleAddresses}
            image={image}
            maxLengthOfRelativeAddress={maxLengthOfAllRelativeAddresses}
            registers={{}} //TODO: Fix registers
            isFrameAfterLastNonApp={isFrameAfterLastNonApp}
            includeSystemFrames={includeSystemFrames}
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
      frames[lastFrame] = React.cloneElement(frames[lastFrame], {
        registers: data.registers,
      });
    }

    if (newestFirst) {
      frames.reverse();
    }

    const className = this.getClassName();

    return (
      <Wrapper className={className}>
        <StyledPlatformIcon
          platform={platform}
          size="20px"
          style={{borderRadius: '3px 0 0 3px'}}
        />
        <ul>{frames}</ul>
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  position: relative;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  top: -1px;
  left: -20px;
`;
