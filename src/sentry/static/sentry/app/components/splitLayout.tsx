import React from 'react';
import classNames from 'classnames';

import SpreadLayout from 'app/components/spreadLayout';

type Props<T extends HTMLElement> = React.ComponentProps<typeof SpreadLayout> & {
  children: Omit<React.ReactHTMLElement<T>, 'ref'>[];
  /**
   * Distance in number of pixels to separate the children
   */
  splitWidth: number;
};

// Flexbox, use when you want your children to be equal sizes
const SplitLayout = <T extends HTMLElement>({
  children,
  className,
  responsive,
  splitWidth,
  ...props
}: Props<T>) => {
  const cx = classNames('split-layout', className, {'allow-responsive': responsive});

  let childCount = 0;
  const totalChildren = React.Children.count(children);

  return (
    <SpreadLayout {...props} className={cx}>
      {React.Children.map(children, child => {
        childCount++;
        const childProps = child?.props ?? {};
        const isLastChild = childCount === totalChildren;

        return React.cloneElement(child, {
          style: {
            marginRight: isLastChild ? undefined : splitWidth,
            ...(child?.props?.style ?? {}),
          },
          className: classNames(childProps.className, 'split-layout-child'),
        });
      })}
    </SpreadLayout>
  );
};

export default SplitLayout;
