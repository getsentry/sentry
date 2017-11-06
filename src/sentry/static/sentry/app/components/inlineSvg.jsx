import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

const InlineSvg = ({src, className, color, style, size}) => {
  const {id, viewBox} = require(`../icons/${src}`).default;

  return (
    <svg viewBox={viewBox} width={size || "1em"}>
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
};

export default InlineSvg;
