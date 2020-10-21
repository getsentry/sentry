import PropTypes from 'prop-types';
import * as React from 'react';
import classNames from 'classnames';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  responsive?: boolean;
  center?: boolean;
};

// Flexbox container whose children will have `justify-content: space-between`
//
// Intended for children.length === 2
// "responsive" will change flex-direction to be column on small widths
const SpreadLayout = ({
  responsive = false,
  center = true,
  children,
  className,
  ...props
}: Props) => {
  const cx = classNames('spread-layout', className, {
    center,
    'allow-responsive': responsive,
  });

  return (
    <div {...props} className={cx}>
      {children}
    </div>
  );
};

SpreadLayout.propTypes = {
  responsive: PropTypes.bool,
  center: PropTypes.bool,
  children: PropTypes.node,
  style: PropTypes.object,
};

export default SpreadLayout;
