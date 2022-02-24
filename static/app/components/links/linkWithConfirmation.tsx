import * as React from 'react';
import classNames from 'classnames';

import {ButtonProps} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';

type Props = {
  message: React.ReactNode;
  onConfirm: () => void;
  title: string;
  className?: string;
  disabled?: boolean;
  priority?: ButtonProps['priority'];
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
