import * as React from 'react';
import classNames from 'classnames';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';

type Props = {
  message: React.ReactNode;
  title: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  priority?: React.ComponentProps<typeof Button>['priority'];
};

/**
 * <Confirm> is a more generic version of this component
 */
class LinkWithConfirmation extends React.PureComponent<Props> {
  render() {
    const {className, disabled, title, children, ...otherProps} = this.props;
    return (
      <Confirm {...otherProps} disabled={disabled}>
        <a href="#" className={classNames(className || '', {disabled})} title={title}>
          {children}
        </a>
      </Confirm>
    );
  }
}

export default LinkWithConfirmation;
