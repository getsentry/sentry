import {CSSProperties, useRef} from 'react';
import * as React from 'react';
import classNames from 'classnames';

import {isRenderFunc} from 'app/utils/isRenderFunc';
import {selectText} from 'app/utils/selectText';

type ChildRenderProps = {
  doSelect: () => void;
  doMount: (el: HTMLElement) => void;
};

type ChildFunction = (props: ChildRenderProps) => React.ReactNode;

type Props = {
  /**
   * Can be a `node` for a simple auto select div container.
   * When children is a render function, it is passed 2 functions:
   * - `doMount` - should be applied on parent element's `ref` whose
   * children is the text to be copied
   * - `doSelect` - selects text
   */
  children: React.ReactNode | ChildFunction;
  className?: string;
  style?: CSSProperties;
};

function AutoSelectText({children, className, ...props}: Props) {
  const element = useRef<HTMLElement>();

  function handleClick() {
    if (!element.current) {
      return;
    }
    selectText(element.current);
  }

  function handleMount(el: HTMLElement) {
    element.current = el;
  }

  if (isRenderFunc<ChildFunction>(children)) {
    return children({
      doMount: handleMount,
      doSelect: handleClick,
    });
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
      <span ref={handleMount}>{children}</span>
    </div>
  );
}

export default AutoSelectText;
