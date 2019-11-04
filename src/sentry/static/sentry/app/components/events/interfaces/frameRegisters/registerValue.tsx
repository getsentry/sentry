import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

const REGISTER_VIEWS = [t('Hexadecimal'), t('Numeric')];

type Props = {
  value: string | number;
};

type State = {
  view: number;
};

export default class RegisterValue extends React.Component<Props, State> {
  state = {
    view: 0,
  };

  toggleView = () => {
    this.setState(state => ({view: (state.view + 1) % REGISTER_VIEWS.length}));
  };

  formatValue = (value: Props['value']) => {
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
    } catch (e) {
      return value;
    }
  };

  render() {
    return (
      <InlinePre>
        <FixedWidth>{this.formatValue(this.props.value)}</FixedWidth>
        <Tooltip title={REGISTER_VIEWS[this.state.view]}>
          <Toggle className="icon-filter" onClick={this.toggleView} />
        </Tooltip>
      </InlinePre>
    );
  }
}

const InlinePre = styled('pre')`
  display: inline;
`;

const FixedWidth = styled('span')`
  width: 12em;
  text-align: right;
`;

const Toggle = styled('span')`
  opacity: 0.33;
  margin-left: 1ex;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;
