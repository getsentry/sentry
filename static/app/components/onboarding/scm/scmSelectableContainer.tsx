import type {ContainerProps} from '@sentry/scraps/layout';
import {Container} from '@sentry/scraps/layout';

type ScmSelectableContainerProps = ContainerProps & {
  isSelected: boolean;
  /**
   * Accent borders are thicker than secondary borders, causing a layout
   * shift when toggling selection. This compensation value offsets the
   * difference via marginBottom (selected/danger) / borderBottomWidth (default).
   * Will be unnecessary once the design system provides a stable-height
   * selected border variant.
   */
  borderCompensation?: number;
  /**
   * When true, renders a danger (red) border instead of the accent border.
   * Uses the same border thickness as the selected state so the row does not
   * jump when transitioning between configured and removing.
   */
  isDanger?: boolean;
};

export function ScmSelectableContainer({
  isSelected,
  isDanger,
  borderCompensation = 2,
  style,
  ...props
}: ScmSelectableContainerProps) {
  const isThickBorder = isSelected || isDanger;
  return (
    <Container
      border={isDanger ? 'danger' : isSelected ? 'accent' : 'secondary'}
      radius="md"
      style={{
        ...(isThickBorder
          ? {marginBottom: borderCompensation - 1}
          : {borderBottomWidth: borderCompensation}),
        ...style,
      }}
      {...props}
    />
  );
}
