import React from 'react';
import styled from '@emotion/styled';

import {SentryTransactionEvent} from 'app/types';
import {defined} from 'app/utils';
import {
  WEB_VITAL_ACRONYMS,
  LONG_WEB_VITAL_NAMES,
} from 'app/views/performance/transactionVitals/constants';
import Tooltip from 'app/components/tooltip';

import {
  getMeasurements,
  toPercent,
  getMeasurementBounds,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';
import * as MeasurementsManager from './measurementsManager';

type Props = {
  event: SentryTransactionEvent;
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
        {Array.from(measurements).map(([timestamp, names]) => {
          const bounds = getMeasurementBounds(timestamp, generateBounds);

          const shouldDisplay = defined(bounds.left) && defined(bounds.width);

          if (!shouldDisplay) {
            return null;
          }

          const hoverMeasurementName = names.join('');

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
            <MeasurementsManager.Consumer key={String(timestamp)}>
              {({hoveringMeasurement, notHovering}) => {
                return (
                  <LabelContainer
                    key={label}
                    label={label}
                    tooltipLabel={tooltipLabel}
                    left={toPercent(bounds.left || 0)}
                    onMouseLeave={() => {
                      notHovering();
                    }}
                    onMouseOver={() => {
                      hoveringMeasurement(hoverMeasurementName);
                    }}
                  />
                );
              }}
            </MeasurementsManager.Consumer>
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
`;

const Label = styled('div')`
  transform: translateX(-50%);
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export default MeasurementsPanel;

type LabelContainerProps = {
  left: string;
  label: string;
  tooltipLabel: string;
  onMouseLeave: () => void;
  onMouseOver: () => void;
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
    const {left, onMouseLeave, onMouseOver, label, tooltipLabel} = this.props;

    return (
      <StyledLabelContainer
        ref={this.elementDOMRef}
        style={{
          left: `clamp(calc(0.5 * ${this.state.width}px), ${left}, calc(100% - 0.5 * ${this.state.width}px))`,
        }}
        onMouseLeave={() => {
          onMouseLeave();
        }}
        onMouseOver={() => {
          onMouseOver();
        }}
      >
        <Label>
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
