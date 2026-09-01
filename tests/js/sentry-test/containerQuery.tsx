import {type ReactNode, useRef} from 'react';

import {ContainerQueryProvider} from '@sentry/scraps/layout';

/**
 * Container responsive props resolve against the nearest query container, so
 * anything under test that reads one has to be rendered inside this.
 */
export function QueryContainer({children}: {children: ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <ContainerQueryProvider elementRef={ref}>
      <div ref={ref}>{children}</div>
    </ContainerQueryProvider>
  );
}

/**
 * `clientWidth` is an accessor on Element.prototype (not HTMLElement); spy there
 * so the fake is actually hit and `restoreAllMocks` cleans it up.
 */
export function setContainerWidth(width: number) {
  jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(width);
}
