/* eslint-disable no-unused-vars */
/* eslint-disable react/no-unused-prop-types */

// This modules is intended to be a drop-in replacement for grid-emotion
// with a similar API but is based on our app's spacing and breakpoints

import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import space from '../styles/space';
import theme from '../utils/theme';

class Base extends React.Component {
  static propTypes = {
    w: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
    m: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    mx: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    my: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    ml: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    mr: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    mb: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    mt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    p: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    px: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    py: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    pl: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    pr: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    pb: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    pt: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    flex: PropTypes.string,
    alignItems: PropTypes.string,
    justifyContent: PropTypes.string,
    flexDirection: PropTypes.string,
    flexWrap: PropTypes.string,
  };

  getSpacingRules = () => {
    const spacingProps = [
      ['m', ['margin']],
      ['mx', ['margin-left', 'margin-right']],
      ['my', ['margin-top', 'margin-bottom']],
      ['ml', ['margin-left']],
      ['mr', ['margin-right']],
      ['mt', ['margin-top']],
      ['mb', ['margin-bottom']],
      ['p', ['padding']],
      ['px', ['padding-left', 'padding-right']],
      ['py', ['padding-top', 'padding-bottom']],
      ['pl', ['padding-left']],
      ['pr', ['margin-right']],
      ['pt', ['padding-top']],
      ['pb', ['padding-bottom']],
    ];

    const rules = [];

    spacingProps.forEach(([prop, cssProperties]) => {
      const val = this.getSpacingValue(this.props[prop]);
      if (typeof val !== 'undefined') {
        cssProperties.forEach(property => {
          rules.push(`${property}:${val};`);
        });
      }
    });

    return rules;
  };

  getSpacingValue = prop => {
    switch (typeof prop) {
      case 'number':
        return space(prop);
      case 'string':
        return prop;
      case 'undefined':
      default:
        return undefined;
    }
  };

  getWidthRules = () => {
    const rules = [];
    const type = typeof this.props.w;
    if (type === 'number') {
      rules.push(`width:${this.getWidthValue(this.props.w)};`);
    } else if (Array.isArray(this.props.w) && this.props.w.length > 0) {
      const firstVal = this.getWidthValue(this.props.w[0]);

      rules.push(`width:${this.getWidthValue(firstVal)};`);

      this.props.w.slice(1).forEach((wVal, idx) => {
        rules.push(
          `@media(min-width:${theme.breakpoints[idx]}){width:${this.getWidthValue(
            wVal
          )}};`
        );
      });
    } else if (type === 'string') {
      rules.push(`width:${this.props.w};`);
    }

    return rules;
  };

  getWidthValue = num => {
    if (typeof num === 'number') {
      const isPx = num >= 1;
      return isPx ? `${num}px` : `${num * 100}%`;
    } else {
      return num;
    }
  };

  getFlexRules = () => {
    const rules = [];
    const mapping = [
      ['alignItems', 'align-items'],
      ['justifyContent', 'justify-content'],
      ['flexDirection', 'flex-direction'],
      ['flexWrap', 'flex-wrap'],
    ];

    mapping.forEach((prop, cssProperty) => {
      if (typeof this.props[prop] !== 'undefined') {
        rules.push(`${cssProperty}:${this.props[prop]};`);
      }
    });
    return rules;
  };

  getFlexChildRules = () => {
    const rules = [];
    if (typeof this.props.flex !== 'undefined') {
      rules.push(`flex:${this.props.flex};`);
    }

    return rules;
  };
}

export class Box extends Base {
  render() {
    const {
      w,
      m,
      mx,
      my,
      ml,
      mr,
      mt,
      mb,
      p,
      px,
      py,
      pl,
      pr,
      pt,
      pb,
      flex,
      ...otherProps
    } = this.props;

    const rules = [
      ...this.getSpacingRules(),
      ...this.getWidthRules(),
      ...this.getFlexChildRules(),
    ];

    const StyledBox = styled('div')`
      ${rules.join('')};
    `;

    return <StyledBox {...otherProps}>{this.props.children}</StyledBox>;
  }
}

export class Flex extends Base {
  render() {
    const {
      w,
      m,
      mx,
      my,
      ml,
      mr,
      mt,
      mb,
      p,
      px,
      py,
      pl,
      pr,
      pt,
      pb,
      flex,
      alignItems,
      justifyContent,
      flexDirection,
      flexWrap,
      ...otherProps
    } = this.props;

    const rules = [
      'display:flex;',
      ...this.getSpacingRules(),
      ...this.getWidthRules(),
      ...this.getFlexChildRules(),
      ...this.getFlexRules(),
    ];

    const StyledFlex = styled('div')`
      ${rules.join('')};
    `;

    return <StyledFlex {...otherProps}>{this.props.children}</StyledFlex>;
  }
}
