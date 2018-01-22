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
    background: ${props.theme.offWhite};
    border: 1px solid ${props.theme.borderLight};
    border-radius: 2px;
    padding: 0.5em;
    transition: border 0.2s ease;
    resize: vertical;

    ${readOnlyStyle(props)};

    &:focus {
      outline: none;
      background: #fff;
    }

    &:hover,
    &:focus {
      border: 1px solid ${props.theme.borderDark};
    }

    &::placeholder {
      color: ${props.theme.gray2};
    }
  `;
};

export {inputStyles};
