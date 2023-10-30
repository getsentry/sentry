import {Component} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {nullableValue} from './fieldRenderers';

type Props = {
  value: Array<string | null>;
};
type State = {
  expanded: boolean;
};

class ArrayValue extends Component<Props, State> {
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
      <ArrayContainer expanded={expanded}>
        {expanded &&
          value
            .slice(0, value.length - 1)
            .map((item, i) => (
              <ArrayItem key={`${i}:${item}`}>{nullableValue(item)}</ArrayItem>
            ))}
        <ArrayItem>{nullableValue(value.slice(-1)[0])}</ArrayItem>
        {value.length > 1 ? (
          <ButtonContainer>
            <button onClick={this.handleToggle}>
              {expanded ? t('[collapse]') : t('[+%s more]', value.length - 1)}
            </button>
          </ButtonContainer>
        ) : null}
      </ArrayContainer>
    );
  }
}

const ArrayContainer = styled('div')<{expanded: boolean}>`
  display: flex;
  flex-direction: ${p => (p.expanded ? 'column' : 'row')};

  & button {
    background: none;
    border: 0;
    outline: none;
    padding: 0;
    cursor: pointer;
    color: ${p => p.theme.linkColor};
    margin-left: ${space(0.5)};
  }
`;

const ArrayItem = styled('span')`
  flex-shrink: 1;
  display: block;

  ${p => p.theme.overflowEllipsis};
  width: unset;
`;

const ButtonContainer = styled('div')`
  white-space: nowrap;
`;

export default ArrayValue;
