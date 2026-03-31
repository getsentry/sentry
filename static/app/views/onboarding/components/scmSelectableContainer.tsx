import type {ContainerProps} from '@sentry/scraps/layout';
import {Container} from '@sentry/scraps/layout';

type ScmSelectableContainerProps = ContainerProps & {
  isSelected: boolean;
  /**
   * Accent borders are thicker than secondary borders, causing a layout
   * shift when toggling selection. This compensation value offsets the
   * difference via marginBottom (selected) / borderBottomWidth (unselected).
   * Will be unnecessary once the design system provides a stable-height
   * selected border variant.
   */
  borderCompensation?: number;
};

export function ScmSelectableContainer({
  isSelected,
  borderCompensation = 2,
  style,
  ...props
}: ScmSelectableContainerProps) {
  return (
    <Container
      border={isSelected ? 'accent' : 'secondary'}
      radius="md"
      style={{
        ...(isSelected
          ? {marginBottom: borderCompensation - 1}
          : {borderBottomWidth: borderCompensation}),
        ...style,
      }}
      {...props}
    />
  );
}
