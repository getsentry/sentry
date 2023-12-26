import classNames from 'classnames';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {}

export default function Input({className, ...otherProps}: Props) {
  const {children: _, ...props} = otherProps;
  return <input className={classNames('form-control', className)} {...props} />;
}
