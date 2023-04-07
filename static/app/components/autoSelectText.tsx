import {forwardRef, useImperativeHandle, useRef} from 'react';
import classNames from 'classnames';

import {selectText} from 'sentry/utils/selectText';

type Props = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

type AutoSelectHandle = {
  selectText: () => void;
};

function AutoSelectText(
  {children, className, ...props}: Props,
  forwardedRef: React.Ref<AutoSelectHandle>
) {
  const element = useRef<HTMLSpanElement>(null);

  // We need to expose a selectText method to parent components
  // and need an imperative ref handle.
  useImperativeHandle(forwardedRef, () => ({
    selectText: () => handleClick(),
  }));

  function handleClick() {
    if (!element.current) {
      return;
    }
    selectText(element.current);
  }

  // use an inner span here for the selection as otherwise the selectText
  // function will create a range that includes the entire part of the
  // div (including the div itself) which causes newlines to be selected
  // in chrome.
  return (
    <div
      {...props}
      onClick={handleClick}
      className={classNames('auto-select-text', className)}
    >
      <span ref={element}>{children}</span>
    </div>
  );
}

export default forwardRef(AutoSelectText);
