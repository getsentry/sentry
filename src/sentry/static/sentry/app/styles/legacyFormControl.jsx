import {css} from 'react-emotion';

const disabled = css`
  border: 1px solid #e2dee6;
  background: #f7f8f9;
  color: #493e54;
`;

const legacyFormControl = css`
  /* sentry overrides (less/forms.less) */
  box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.04);
  height: auto;
  border: 1px solid #c9c0d1;
  padding: 8px 12px 7px;
  position: relative;
  border-radius: 3px;
  color: #493e54;

  &.disabled {
    ${disabled};
  }

  &:focus {
    border-color: #a598b2;
    box-shadow: inset 0 2px 0 rgba(0, 0, 0, 0.04), 0 0 6px rgba(177, 171, 225, 0.3);
    outline: none;
  }

  /* bootstrap */
  display: block;
  width: 100%;
  font-size: 14px;
  line-height: 1.42857143;
  background-color: #fff;
  background-image: none;
  transition: border-color ease-in-out 0.15s, box-shadow ease-in-out 0.15s;
`;

export {legacyFormControl};
