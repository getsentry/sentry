import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

import {CLASSNAMES} from './resizePanel';

// This is the generated SVG from https://github.com/getsentry/sentry/blob/master/static/app/icons/iconGrabbable.tsx
// I couldn't sort out how to extract it from the react component. I think it
// could be done react-dom-server or to render it inside an unmounted dom node
// then copy the html content. All that seemed slower to build and slower to
// exec compared to having an encoded svg.
const GrabberColor = encodeURIComponent(theme.gray300);
const GrabberSVG =
  `url('data:image/svg+xml,` +
  `%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="${GrabberColor}" height="16px" width="16px"%3E` +
  '%3Ccircle cx="4.73" cy="8" r="1.31"%3E%3C/circle%3E' +
  '%3Ccircle cx="4.73" cy="1.31" r="1.31"%3E%3C/circle%3E' +
  '%3Ccircle cx="11.27" cy="8" r="1.31"%3E%3C/circle%3E' +
  '%3Ccircle cx="11.27" cy="1.31" r="1.31"%3E%3C/circle%3E' +
  '%3Ccircle cx="4.73" cy="14.69" r="1.31"%3E%3C/circle%3E' +
  '%3Ccircle cx="11.27" cy="14.69" r="1.31"%3E%3C/circle%3E' +
  '%3C/svg%3E' +
  `')`;

const Container = styled('div')`
  width: 100%;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-flow: nowrap column;
  overflow: hidden;
  padding: ${space(2)};

  .${CLASSNAMES.bar.width} {
    cursor: ew-resize;
    height: 100%;
    width: ${space(2)};
  }

  .${CLASSNAMES.bar.height} {
    cursor: ns-resize;
    height: ${space(2)};
    width: 100%;
  }
  .${CLASSNAMES.bar.height}.overlapDown {
    height: calc(16px + 34px); /* Spacing between components + height of <FocusTabs> */
    margin-bottom: -34px; /* The height of the <FocusTabs> text + border */
    z-index: ${p => p.theme.zIndex.initial};
  }

  .${CLASSNAMES.bar.height}, .${CLASSNAMES.bar.width} {
    background: transparent;
    display: flex;
    align-items: center;
    align-content: center;
    justify-content: center;
  }
  .${CLASSNAMES.bar.height}:hover, .${CLASSNAMES.bar.width}:hover {
    background: ${p => p.theme.hover};
  }

  .${CLASSNAMES.handle.width} {
    height: ${space(3)};
    width: ${space(2)};
  }

  .${CLASSNAMES.handle.height} {
    height: ${space(2)};
    width: ${space(3)};
    transform: rotate(90deg);
  }

  .${CLASSNAMES.handle.height} > span,
  .${CLASSNAMES.handle.width} > span {
    display: block;
    background: transparent ${GrabberSVG} center center no-repeat;
    width: 100%;
    height: 100%;
  }
`;

export default Container;
