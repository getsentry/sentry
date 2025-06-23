// The purpose of this exploration is to find the most ergonomic API for
// a component that could power our layout system. It is important to note
// that this component is a building block for the desig system, and is not
// intended for direct use in the codebase. The consumers would in part get
// to interface with it's API, but would not be able to import or use it
// directly. The main reason for this decision is that it's API is too broad,
// which goes against the goal of providing a good out of the box experience.

// I named the component "Container" to avoid any confusion or thinking that
// this is somehow similar to our old Box component - it is not.

// On the topic of developer experience, there are a few important things to note:
// - Using such a component should not require any additional imports aside from
//   the component itself.
// - The component should be able to be used in a way that is close to the native
//   CSS API,while still conforming to our design system nomenclature. This is
//   important because we want users to start building the muscle for thinking
//   in design system tokens, but also because it will speed up their development
//   process in the long run.
// - The types should be inferred from the component props, and not require manual
//   type definitions or overrides.
// - The API should require the least amount of go to source definitions for users.
//   As an example, adding JSDoc annotations for margin or padding with the values
//   used by the system could allow users to more accurately understand what each
//   sizing refers to without having to go to source which would minimize the back
//   and forth between the component and the source file and speed up developments

import styled from '@emotion/styled';

// A subset of the space tokens as I imagine values above 3xl would not be needed.
type Space = 'none' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// Type safe implementation of the CSS shorthand syntax.
type ShorthandCSSValue =
  | `${Space}`
  | `${Space} ${Space}`
  | `${Space} ${Space} ${Space}`
  | `${Space} ${Space} ${Space} ${Space}`;

// Example usage is <Container margin="sm lg" padding="sm lg" />
// At the cost of some parsing and validation logic, this is a fully type safe
// implementation that does not require any additional imports. It supports
// setting values for all sides of the box in the same way a native CSS API would.
//
// Some viable approaches:
//
// #1: Polymorphic styled component
// This version has the simplest API, by only allowing shorthand values, it is
// designed under the assumption that overriding values is not supported,
// which might seem restrictive, but it serves as a good forcing function for
// the design system goal of providing good composable primitives.

// Open questions:
// - Can we afford to only support shorthand values?
// - Do we even need to use styled here?

// Drawback:
// - The values defined in the JSDoc are prone to falling out of sync, and we
//   need to either rely on the design system authors to enforce they are up to
//   date, or build tooling that validates and enforces this.
// - We do not control the implementation of "as" prop, which could lead to
//   broken implementations if className or style props are not supported by
//   the underlying element. This can partially be mitigated if the component
//   is not exported, and we can rely on the design system authors to enforce
//   the correct usage of the component. We could mitigate this by only supporting
//   intrinsic elements, which I belive would be a good idea given how low level
//   this component is.
type PolymorphicComponentProps<T extends React.ElementType = 'div'> = {
  as?: T;
  /**
   * sm: 6px,
   * md: 8px,
   * lg: 12px,
   * xl: 16px,
   * 2xl: 24px,
   */
  gap?: `${Space}`;
  /**
   * sm: 6px,
   * md: 8px,
   * lg: 12px,
   * xl: 16px,
   * 2xl: 24px,
   */
  margin?: ShorthandCSSValue;
  /**
   * sm: 6px,
   * md: 8px,
   * lg: 12px,
   * xl: 16px,
   * 2xl: 24px,
   */
  padding?: ShorthandCSSValue;
} & React.ComponentProps<T>;

export function PolymorphicStyledContainer<T extends React.ElementType = 'div'>({
  as,
  ...props
}: PolymorphicComponentProps<T>) {
  return <StyledContainer as={as || 'div'} {...props} />;
}

const StyledContainer = styled(PolymorphicStyledContainer)``;

function ExampleOfPolymorphicStyledContainer() {
  return <PolymorphicStyledContainer margin="sm lg" padding="sm lg" gap="sm" />;
}
