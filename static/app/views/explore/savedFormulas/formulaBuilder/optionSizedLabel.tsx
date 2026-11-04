import {Container, Grid} from '@sentry/scraps/layout';

/**
 * Stacks every option label in one grid cell so a select trigger is as wide as
 * its longest option and doesn't resize when the selection changes.
 */
export function OptionSizedLabel({
  children,
  options,
}: {
  children: React.ReactNode;
  options: Array<{label: string}>;
}) {
  return (
    <Grid as="span">
      {options.map(option => (
        <Container
          key={option.label}
          as="span"
          area="1 / 1"
          visibility="hidden"
          aria-hidden
        >
          {option.label}
        </Container>
      ))}
      <Container as="span" area="1 / 1">
        {children}
      </Container>
    </Grid>
  );
}
