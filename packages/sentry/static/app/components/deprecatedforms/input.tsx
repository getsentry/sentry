import classNames from 'classnames';
import omit from 'lodash/omit';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {}

export default function Input({className, ...otherProps}: Props) {
  return (
    <input
      className={classNames('form-control', className)}
      {...omit(otherProps, 'children')}
    />
  );
}
