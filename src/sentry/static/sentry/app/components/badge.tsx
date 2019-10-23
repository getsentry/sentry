import PropTypes from 'prop-types';
import React from 'react';
import {cx} from 'react-emotion';

type Props = {
  text?: string;
  priority?: string;
  className?: string;
};

const Badge = ({priority, className, text}: Props) => (
  <span className={cx('badge', priority, className)}>{text}</span>
);

Badge.propTypes = {
  text: PropTypes.string,
  priority: PropTypes.oneOf(['strong', 'new', 'highlight']),
};

export default Badge;
