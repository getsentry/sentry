import React from 'react';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon>;

const IconQuill = React.forwardRef(function IconQuill(
  props: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M12.87 7.46a4.3 4.3 0 011.92 1.26 2.89 2.89 0 01.1 3.85 1.83 1.83 0 00-.36 1.95c.05.2.09.41.13.61l-.13.1c-.28-.17-.58-.33-.85-.51a2.54 2.54 0 00-2-.5 4.62 4.62 0 01-4.17-1.4A3 3 0 016.68 11l-.35.18a2.38 2.38 0 01-1.24.18 4 4 0 001.37.28 5.22 5.22 0 01-2.33.9 3 3 0 00.75.26 6.57 6.57 0 01-3.24.3L.18 15.62 0 15.5a19 19 0 011.25-2.66L1 12.4a4.15 4.15 0 01-.22-3.23l.32.92c.12-1.15-.05-2.34.7-3.54.08.81.25 2.11.28 2.12a2.2 2.2 0 00.14-.78 5.14 5.14 0 012.17-4.45 13.3 13.3 0 018.21-3 6 6 0 013.4.87 4.87 4.87 0 00-1.55 3 7.9 7.9 0 01-1.37 2.88z" />
    </SvgIcon>
  );
});

IconQuill.displayName = 'IconQuill';

export {IconQuill};
