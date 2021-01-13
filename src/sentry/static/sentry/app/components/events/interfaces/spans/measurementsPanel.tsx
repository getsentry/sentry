import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {EventTransaction} from 'app/types/event';
import {defined} from 'app/utils';
import {
  LONG_WEB_VITAL_NAMES,
  WEB_VITAL_ACRONYMS,
} from 'app/views/performance/transactionVitals/constants';

import {
  getMeasurementBounds,
  getMeasurements,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  toPercent,
} from './utils';

type Props = {
  event: EventTransaction;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  dividerPosition: number;
};
class MeasurementsPanel extends React.PureComponent<Props> {
  render() {
    const {event, generateBounds, dividerPosition} = this.props;

    const measurements = getMeasurements(event);

    return (
      <Container
        style={{
          // the width of this component is shrunk to compensate for half of the width of the divider line
          width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
        }}
      >
        {Array.from(measurements).map(([timestamp, verticalMark]) => {
          const bounds = getMeasurementBounds(timestamp, generateBounds);

          const shouldDisplay = defined(bounds.left) && defined(bounds.width);

          if (!shouldDisplay || !bounds.isSpanVisibleInView) {
            return null;
          }

          const names = Object.keys(verticalMark.marks);

          // generate vertical marker label
          const acronyms = names.map(name => WEB_VITAL_ACRONYMS[name]);
          const lastAcronym = acronyms.pop() as string;
          const label = acronyms.length
            ? `${acronyms.join(', ')} & ${lastAcronym}`
            : lastAcronym;

          // generate tooltip labe;l
          const longNames = names.map(name => LONG_WEB_VITAL_NAMES[name]);
          const lastName = longNames.pop() as string;
          const tooltipLabel = longNames.length
            ? `${longNames.join(', ')} & ${lastName}`
            : lastName;

          return (
            <LabelContainer
              key={String(timestamp)}
              failedThreshold={verticalMark.failedThreshold}
              label={label}
              tooltipLabel={tooltipLabel}
              left={toPercent(bounds.left || 0)}
            />
          );
        })}
      </Container>
    );
  }
}

const Container = styled('div')`
  position: relative;
  overflow: hidden;

  height: 20px;
`;

const StyledLabelContainer = styled('div')`
  position: absolute;
  top: 0;
  height: 100%;
  user-select: none;
  white-space: nowrap;
`;

const Label = styled('div')<{failedThreshold: boolean}>`
  transform: translateX(-50%);
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: 600;
  ${p => (p.failedThreshold ? `color: ${p.theme.red300};` : null)}
`;

export default MeasurementsPanel;

type LabelContainerProps = {
  left: string;
  label: string;
  tooltipLabel: string;
  failedThreshold: boolean;
};

type LabelContainerState = {
  width: number;
};

class LabelContainer extends React.Component<LabelContainerProps> {
  state: LabelContainerState = {
    width: 1,
  };

  componentDidMount() {
    const {current} = this.elementDOMRef;
    if (current) {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        width: current.clientWidth,
      });
    }
  }

  elementDOMRef = React.createRef<HTMLDivElement>();

  render() {
    const {left, label, tooltipLabel, failedThreshold} = this.props;

    return (
      <StyledLabelContainer
        ref={this.elementDOMRef}
        style={{
          left: `clamp(calc(0.5 * ${this.state.width}px), ${left}, calc(100% - 0.5 * ${this.state.width}px))`,
        }}
      >
        <Label failedThreshold={failedThreshold}>
          <Tooltip
            title={tooltipLabel}
            position="top"
            containerDisplayMode="inline-block"
          >
            {label}
          </Tooltip>
        </Label>
      </StyledLabelContainer>
    );
  }
}
