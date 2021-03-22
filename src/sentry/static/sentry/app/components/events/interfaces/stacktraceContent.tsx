import React from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Line from 'app/components/events/interfaces/frame/line';
import {
  getImageRange,
  parseAddress,
  stackTracePlatformIcon,
} from 'app/components/events/interfaces/utils';
import {t} from 'app/locale';
import {Frame, Organization, PlatformType} from 'app/types';
import {Event} from 'app/types/event';
import {StacktraceType} from 'app/types/stacktrace';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withOrganization from 'app/utils/withOrganization';

const defaultProps = {
  includeSystemFrames: true,
  expandFirstFrame: true,
};

type DefaultProps = typeof defaultProps;

type Props = {
  data: StacktraceType;
  platform: PlatformType;
  event: Event;
  newestFirst?: boolean;
  className?: string;
  isHoverPreviewed?: boolean;
  organization?: Organization;
} & Partial<DefaultProps>;

type State = {
  showingAbsoluteAddresses: boolean;
  showCompleteFunctionName: boolean;
};

class StacktraceContent extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    includeSystemFrames: true,
    expandFirstFrame: true,
  };

  state: State = {
    showingAbsoluteAddresses: false,
    showCompleteFunctionName: false,
  };

  componentDidMount() {
    const {isHoverPreviewed, organization, event} = this.props;

    if (isHoverPreviewed) {
      trackAnalyticsEvent({
        eventKey: 'stacktrace.preview.open',
        eventName: 'Stack Trace Preview: Open',
        organization_id: organization?.id ? parseInt(organization.id, 10) : '',
        issue_id: event.groupID,
      });
    }
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
    event.stopPropagation(); // to prevent collapsing if collapsable

    this.setState(prevState => ({
      showingAbsoluteAddresses: !prevState.showingAbsoluteAddresses,
    }));
  };

  handleToggleFunctionName = (event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation(); // to prevent collapsing if collapsable

    this.setState(prevState => ({
      showCompleteFunctionName: !prevState.showCompleteFunctionName,
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
    } = this.props;
    const {showingAbsoluteAddresses, showCompleteFunctionName} = this.state;

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

    const frames: React.ReactElement[] = [];
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

    const isFrameAfterLastNonApp = this.isFrameAfterLastNonApp();

    (data.frames ?? []).forEach((frame, frameIdx) => {
      const prevFrame = (data.frames ?? [])[frameIdx - 1];
      const nextFrame = (data.frames ?? [])[frameIdx + 1];
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
        const image = this.findImageForAddress(frame.instructionAddr, frame.addrMode);

        frames.push(
          <Line
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
            registers={{}} //TODO: Fix registers
            isFrameAfterLastNonApp={isFrameAfterLastNonApp}
            includeSystemFrames={includeSystemFrames}
            onFunctionNameToggle={this.handleToggleFunctionName}
            showCompleteFunctionName={showCompleteFunctionName}
            isHoverPreviewed={isHoverPreviewed}
            isFirst={newestFirst ? frameIdx === lastFrameIdx : frameIdx === 0}
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
          platform={stackTracePlatformIcon(platform, data.frames ?? [])}
          size="20px"
          style={{borderRadius: '3px 0 0 3px'}}
        />
        <StyledList>{frames}</StyledList>
      </Wrapper>
    );
  }
}

export default withOrganization(StacktraceContent);

const Wrapper = styled('div')`
  position: relative;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  top: -1px;
  left: -20px;
`;

const StyledList = styled('ul')`
  list-style: none;
`;
