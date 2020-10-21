import * as React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

type Props = {
  underlined?: boolean;
  className?: string;
};

type NavProps = Omit<React.HTMLProps<HTMLUListElement>, keyof Props> & Props;

function NavTabs(props: NavProps) {
  const {underlined, className, ...tabProps} = props;
  const mergedClassName = classnames('nav nav-tabs', className, {
    'border-bottom': underlined,
  });
  return <ul className={mergedClassName} {...tabProps} />;
}

NavTabs.propTypes = {
  underlined: PropTypes.bool,
};

export default NavTabs;
