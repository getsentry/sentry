import {css} from 'react-emotion';

const inputStyles = props => css`
  color: ${props.theme.gray5};
  display: block;
  width: 100%;
  border: 0;
  border-radius: 2px;
  padding: 10px;
  transition: border 0.2s ease;
  resize: vertical;

  &:focus {
    outline: none;
    background: #f7f7f9;
    border-bottom-color: ${p => props.theme.blue};
  }

  ${p => {
    if (props.error) {
      return css`
    background: #f7f7f9;
    &:hover, &:focus {
      background: #f7f7f9};
    }
    `;
    }
    return '';
  }} &::placeholder {
    color: ${props.theme.gray2};
  }
`;

export {inputStyles};
