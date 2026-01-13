import {Stack, type StackProps} from '@sentry/scraps/layout';

function FluidHeight(props: StackProps<'div'>) {
  return <Stack wrap="nowrap" flexGrow={1} height="100%" overflow="hidden" {...props} />;
}

export default FluidHeight;
