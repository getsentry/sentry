import {Component, createRef} from 'react';
import styled from '@emotion/styled';

import {toPercent} from 'sentry/components/performance/waterfall/utils';
import Tooltip from 'sentry/components/tooltip';
import space from 'sentry/styles/space';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {Vital} from 'sentry/utils/performance/vitals/types';

import {
  getMeasurementBounds,
  getMeasurements,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';

type Props = {
  dividerPosition: number;
  event: EventTransaction;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
};

function MeasurementsPanel(props: Props) {
  const {event, generateBounds, dividerPosition} = props;
  const measurements = getMeasurements(event, generateBounds);

  return (
    <Container
      style={{
        // the width of this component is shrunk to compensate for half of the width of the divider line
        width: `calc(${toPercent(1 - dividerPosition)} - 0.5px)`,
      }}
    >
      {Array.from(measurements.values()).map(verticalMark => {
        const mark = Object.values(verticalMark.marks)[0];
        const {timestamp} = mark;
        const bounds = getMeasurementBounds(timestamp, generateBounds);

        const shouldDisplay = defined(bounds.left) && defined(bounds.width);

        if (!shouldDisplay || !bounds.isSpanVisibleInView) {
          return null;
        }

        // Measurements are referred to by their full name `measurements.<name>`
        // here but are stored using their abbreviated name `<name>`. Make sure
        // to convert it appropriately.
        const vitals: Vital[] = Object.keys(verticalMark.marks).map(
          name => WEB_VITAL_DETAILS[`measurements.${name}`]
        );

        if (vitals.length > 1) {
          return (
            <MultiLabelContainer
              key={String(timestamp)}
              failedThreshold={verticalMark.failedThreshold}
              left={toPercent(bounds.left || 0)}
              vitals={vitals}
            />
          );
        }

        return (
          <LabelContainer
            key={String(timestamp)}
            failedThreshold={verticalMark.failedThreshold}
            left={toPercent(bounds.left || 0)}
            vital={vitals[0]}
          />
        );
      })}
    </Container>
  );
}

const Container = styled('div')`
  position: relative;
  overflow: hidden;

  height: 20px;
`;

const StyledMultiLabelContainer = styled('div')`
  transform: translateX(-50%);
  position: absolute;
  display: flex;
  top: 0;
  height: 100%;
  user-select: none;
  white-space: nowrap;
`;

const StyledLabelContainer = styled('div')`
  position: absolute;
  top: 0;
  height: 100%;
  user-select: none;
  white-space: nowrap;
`;

const Label = styled('div')<{
  failedThreshold: boolean;
  isSingleLabel?: boolean;
}>`
  transform: ${p => (p.isSingleLabel ? `translate(-50%, 15%)` : `translateY(15%)`)};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: 600;
  color: ${p => (p.failedThreshold ? `${p.theme.red300}` : `${p.theme.gray500}`)};
  background: ${p => p.theme.white};
  border: 1px solid;
  border-color: ${p => (p.failedThreshold ? p.theme.red300 : p.theme.gray100)};
  border-radius: ${p => p.theme.borderRadius};
  height: 75%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(0.25)};
  margin-right: ${space(0.25)};
`;

export default MeasurementsPanel;

type LabelContainerProps = {
  failedThreshold: boolean;
  left: string;
  vital: Vital;
};

type LabelContainerState = {
  width: number;
};
class LabelContainer extends Component<LabelContainerProps> {
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

  elementDOMRef = createRef<HTMLDivElement>();

  render() {
    const {left, failedThreshold, vital} = this.props;

    return (
      <StyledLabelContainer
        ref={this.elementDOMRef}
        style={{
          left: `clamp(calc(0.5 * ${this.state.width}px), ${left}, calc(100% - 0.5 * ${this.state.width}px))`,
        }}
      >
        <Label failedThreshold={failedThreshold} isSingleLabel>
          <Tooltip title={vital.name} position="top" containerDisplayMode="inline-block">
            {vital.acronym}
          </Tooltip>
        </Label>
      </StyledLabelContainer>
    );
  }
}

type MultiLabelContainerProps = Omit<LabelContainerProps, 'vital'> & {
  vitals: Vital[];
};

class MultiLabelContainer extends Component<MultiLabelContainerProps> {
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

  elementDOMRef = createRef<HTMLDivElement>();

  render() {
    const {left, failedThreshold, vitals} = this.props;

    return (
      <StyledMultiLabelContainer
        ref={this.elementDOMRef}
        style={{
          left: `clamp(calc(0.5 * ${this.state.width}px), ${left}, calc(100% - 0.5 * ${this.state.width}px))`,
        }}
      >
        {vitals.map(vital => (
          <Label failedThreshold={failedThreshold} key={`${vital.name}-label`}>
            <Tooltip
              title={vital.name}
              position="top"
              containerDisplayMode="inline-block"
            >
              {vital.acronym}
            </Tooltip>
          </Label>
        ))}
      </StyledMultiLabelContainer>
    );
  }
}
