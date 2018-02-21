import {css} from 'react-emotion';

const readOnlyStyle = props =>
  props.readOnly
    ? css`
        cursor: default;
      `
    : '';

const inputStyles = props => {
  return css`
    color: ${props.theme.gray5};
    display: block;
    width: 100%;
    background: #fff;
    border: 1px solid ${props.theme.borderDark};
    border-radius: ${props.theme.borderRadius};
    box-shadow: inset ${props.theme.dropShadowLight};
    padding: 0.5em;
    transition: border 0.1s linear;
    resize: vertical;

    ${readOnlyStyle(props)};

    &:focus {
      outline: none;
    }

    &:hover,
    &:focus,
    &:active {
      border: 1px solid ${props.theme.gray1};
    }

    &::placeholder {
      color: ${props.theme.gray2};
    }
  `;
};

export {inputStyles};
