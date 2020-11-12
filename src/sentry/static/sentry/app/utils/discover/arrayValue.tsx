import React from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  value: string[];
};
type State = {
  expanded: boolean;
};

class ArrayValue extends React.Component<Props, State> {
  state: State = {
    expanded: false,
  };
  handleToggle = () => {
    this.setState(prevState => ({
      expanded: !prevState.expanded,
    }));
  };

  render() {
    const {expanded} = this.state;
    const {value} = this.props;
    return (
      <ArrayContainer>
        {expanded &&
          value
            .slice(0, value.length - 1)
            .map((item, i) => <ArrayItem key={`${i}:${item}`}>{item}</ArrayItem>)}
        <span>
          {value.slice(-1)[0]}
          {value.length > 1 ? (
            <button onClick={this.handleToggle}>
              {expanded ? t('[collapse]') : t('[+%s more]', value.length - 1)}
            </button>
          ) : null}
        </span>
      </ArrayContainer>
    );
  }
}
const ArrayContainer = styled('div')`
  ${overflowEllipsis};

  & button {
    background: none;
    border: 0;
    outline: none;
    padding: 0;
    cursor: pointer;
    color: ${p => p.theme.blue300};
    margin-left: ${space(0.5)};
  }
`;

const ArrayItem = styled('span')`
  display: block;
  ${overflowEllipsis};
`;

export default ArrayValue;
