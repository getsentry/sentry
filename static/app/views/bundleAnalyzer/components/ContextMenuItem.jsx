import cls from 'classnames';

import s from './ContextMenuItem.css';

function noop() {
  return false;
}

export default function ContextMenuItem({children, disabled, onClick}) {
  const className = cls({
    [s.item]: true,
    [s.disabled]: disabled,
  });
  const handler = disabled ? noop : onClick;
  return (
    <li className={className} onClick={handler}>
      {children}
    </li>
  );
}
