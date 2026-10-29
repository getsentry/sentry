import {
  SlideOverPanel as BaseSlideOverPanel,
  type SlideOverPanelProps,
} from '@sentry/scraps/slideOverPanel';

import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

export function SlideOverPanel(props: SlideOverPanelProps) {
  const {contentTop} = useTopOffset();
  return <BaseSlideOverPanel contentTop={contentTop} {...props} />;
}
