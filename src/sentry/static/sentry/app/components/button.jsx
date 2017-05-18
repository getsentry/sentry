import React, {PropTypes} from 'react';
import styled, {css} from 'styled-components';
import {Link} from 'react-router';

/*

  Usage:
    <Button kind="primary" size="lg" to="/stream">Stream</Button>
    <Button size="xs" href="http://sentry.io/">Home</Button>
    <Button kind="danger" onClick={()=> { alert("💥") }}>Careful!</Button>
    <Button disabled>Not Available</Button>

*/

const BaseButton = React.createClass({
  propTypes: {
    kind: PropTypes.oneOf(['primary', 'danger']),
    size: PropTypes.oneOf(['xs', 'sm', 'lg']),
    to: PropTypes.string,
    href: PropTypes.string
  },

  render() {
    let renderedButton;
    const {kind, size, to, href, children, ...buttonProps} = this.props;

    // Buttons come in 3 flavors: Link, anchor, and regular buttons. Let's
    // use props to determine which to serve up, so we don't have to think
    // about it. As a bonus, let's ensure all buttons appear as a button
    // control to screen readers. Note: you must still handle tabindex manually.

    if (to) {
      // Handle react-router Links
      renderedButton = <Link to={to} {...buttonProps} role="button">{children}</Link>;
    } else if (href) {
      // Handle traditional links
      renderedButton = <a href={href} {...buttonProps} role="button">{children}</a>;
    } else {
      // Otherwise, fall back to basic button element
      renderedButton = <button {...buttonProps} role="button">{children}</button>;
    }

    return renderedButton;
  }
});

let Button = styled(BaseButton)`

  /* Base styles for all buttons */

  display: inline-block;
  font-weight: 600;
  border-radius: 3px;
  box-shadow: ${props => props.theme.outerShadow};
  cursor: pointer;

  &:active {
    box-shadow: ${props => props.theme.innerShadow};
  }
  &:focus {
    outline: none;
  }

  /* Use props for kind instead of classes */

  ${props => {
  switch (props.kind) {
    case 'primary':
      return css`
          color: #fff;
          background: ${props.theme.purple};
          border: 1px solid ${props.theme.purpleDarkest};
          &:hover, &:focus, &:active {
            color: #fff;
            background: ${props.theme.purpleDark};
            border-color: ${props.theme.purpleDarkest};
          }
        `;
    case 'danger':
      return css`
          color: #fff;
          background: ${props.theme.red};
          border: 1px solid ${props.theme.redDark};
          &:hover, &:focus, &:active {
            color: #fff;
            background: ${props.theme.redDark};
            border-color: ${props.theme.redDarkest};
          }
        `;
    default:
      return css`
          color: ${props.theme.gray90};
          background: #fff;
          border: 1px solid ${props.theme.borderColorDark};
          &:hover, &:focus, &:active {
            color: ${props.theme.black};
            border-color: ${props.theme.borderColorDarkest};
          }
        `;
  }
}}

  /* Same goes for size */

  ${props => {
  switch (props.size) {
    case 'xs':
      return css`
          padding: 1px 6px;
          font-size: 12px;
        `;
    case 'sm':
      return css`
          padding: 4px 10px;
          font-size: 12px;
        `;
    case 'lg':
      return css`
          font-size: 16px;
          padding: 10px 20px;
        `;
    default:
      return css`
          font-size: 14px;
          padding: 6px 16px;
        `;
  }
}}

    /* Utilize disabled attribute */

    ${props => {
  if (props.disabled) {
    return css`
              color: ${props.theme.gray50};
              border: 1px solid ${props.theme.borderColor};
              background: #fff;
              text-shadow: none;
              box-shadow: none;
              cursor: not-allowed;
              &:hover, &:focus, &:active {
                color: ${props.theme.gray50};
                border: 1px solid ${props.theme.borderColor};
                background: #fff;
              }
            `;
  }
}}

`;

export default Button;
