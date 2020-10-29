import React from 'react';
import styled from '@emotion/styled';

import {Meta} from 'app/types';
import Tooltip from 'app/components/tooltip';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import {IconSliders} from 'app/icons';
import {t} from 'app/locale';

const REGISTER_VIEWS = [t('Hexadecimal'), t('Numeric')];

type Props = {
  value: string | number;
  meta?: Meta;
};

type State = {
  view: number;
};

class frameRegistersValue extends React.Component<Props, State> {
  state = {
    view: 0,
  };

  toggleView = () => {
    this.setState(state => ({view: (state.view + 1) % REGISTER_VIEWS.length}));
  };

  tooltipTitle = () => REGISTER_VIEWS[this.state.view];

  formatValue = () => {
    const value = this.props.value;

    try {
      const parsed = typeof value === 'string' ? parseInt(value, 16) : value;
      if (isNaN(parsed)) {
        return value;
      }

      switch (this.state.view) {
        case 1:
          return `${parsed}`;
        case 0:
        default:
          return `0x${('0000000000000000' + parsed.toString(16)).substr(-16)}`;
      }
    } catch {
      return value;
    }
  };

  render() {
    const formattedValue = this.formatValue();
    const {meta} = this.props;

    return (
      <InlinePre data-test-id="frame-registers-value">
        <FixedWidth>
          <AnnotatedText value={formattedValue} meta={meta} />
        </FixedWidth>
        <Tooltip title={this.tooltipTitle()}>
          <Toggle onClick={this.toggleView} size="xs" />
        </Tooltip>
      </InlinePre>
    );
  }
}

export default frameRegistersValue;

const InlinePre = styled('pre')`
  display: inline;
`;

const FixedWidth = styled('span')`
  width: 11em;
  display: inline-block;
  text-align: right;
  margin-right: 1ex;
`;

const Toggle = styled(IconSliders)`
  opacity: 0.33;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;
