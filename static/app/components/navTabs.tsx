import * as React from 'react';
import classnames from 'classnames';

interface NavProps extends React.HTMLAttributes<HTMLUListElement> {
  underlined?: boolean;
}

function NavTabs({underlined, className, ...tabProps}: NavProps) {
  const mergedClassName = classnames('nav nav-tabs', className, {
    'border-bottom': underlined,
  });

  return <ul className={mergedClassName} {...tabProps} />;
}

export default NavTabs;
