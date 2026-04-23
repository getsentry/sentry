import {Stack, type StackProps} from '@sentry/scraps/layout';

export function FluidHeight(props: StackProps<'div'>) {
  return <Stack wrap="nowrap" flexGrow={1} height="100%" overflow="hidden" {...props} />;
}
