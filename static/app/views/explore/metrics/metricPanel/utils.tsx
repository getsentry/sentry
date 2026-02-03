import {IconChevron} from 'sentry/icons';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';

export const HIDE_BUTTONS_BY_ORIENTATION: Record<
  TableOrientation,
  {
    IconHide: () => React.ReactNode;
    IconShow: () => React.ReactNode;
  }
> = {
  right: {
    IconShow: () => <IconChevron isDouble direction="left" />,
    IconHide: () => <IconChevron isDouble direction="right" />,
  },
  bottom: {
    IconShow: () => <IconChevron isDouble direction="down" />,
    IconHide: () => <IconChevron isDouble direction="up" />,
  },
};
