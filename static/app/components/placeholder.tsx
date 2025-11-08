import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {type ContainerElement} from '@sentry/scraps/layout/container';

export type PlaceholderProps<T extends ContainerElement = 'div'> = FlexProps<T> & {
  /**
   * @deprecated Do not use this component as a replacement for empty state.
   */
  children?: React.ReactNode;
  shape?: 'circle';
};

export function Placeholder(props: PlaceholderProps<'div'>) {
  const {radius, shape, ['data-test-id']: dataTestId, ...rest} = props;
  return (
    <Flex
      direction="column"
      flexShrink={0}
      justify="center"
      align="center"
      background="tertiary"
      width={props.width ?? '100%'}
      height={props.height ?? '60px'}
      radius={shape === 'circle' ? 'full' : (radius ?? 'md')}
      data-test-id={dataTestId ?? 'loading-placeholder'}
      {...rest}
    />
  );
}

export default Placeholder;
