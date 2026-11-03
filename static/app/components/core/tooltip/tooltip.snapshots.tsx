import type {ComponentProps} from 'react';
import {Fragment} from 'react';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip, TooltipContent} from '@sentry/scraps/tooltip/tooltip';

function ExampleTooltip(
  props: Pick<ComponentProps<typeof TooltipContent>, 'children' | 'maxWidth'>
) {
  return (
    <Container padding="xl">
      <TooltipContent
        {...props}
        placement="top"
        arrowProps={{placement: 'top'}}
        data-tooltip
      />
    </Container>
  );
}

function LastSeenCard() {
  return (
    <Fragment>
      <Tooltip.Header trailingItems="8mo ago">Last Seen</Tooltip.Header>
      <Tooltip.Grid columns="max-content 1fr max-content">
        <Tooltip.Row
          leadingItems={<Text size="sm">PDT</Text>}
          trailingItems={
            <Text size="sm" align="right">
              11:40 PM
            </Text>
          }
        >
          <Text size="sm">Jul 28, 2026</Text>
        </Tooltip.Row>
        <Tooltip.Row
          leadingItems={<Text size="sm">UTC</Text>}
          trailingItems={
            <Text size="sm" align="right">
              6:40 AM
            </Text>
          }
        >
          <Text size="sm">Jul 29, 2026</Text>
        </Tooltip.Row>
      </Tooltip.Grid>
      <Tooltip.Footer trailingItems="UTC">Times shown in</Tooltip.Footer>
    </Fragment>
  );
}

describe('Tooltip', () => {
  it.snapshot('plain text', () => (
    <ExampleTooltip>A plain tooltip message.</ExampleTooltip>
  ));

  it.snapshot('wrapped text', () => (
    <ExampleTooltip>
      A longer tooltip message that wraps onto multiple lines within the default maximum
      width.
    </ExampleTooltip>
  ));

  it.snapshot('header only', () => (
    <ExampleTooltip>
      <Tooltip.Header trailingItems="8mo ago">Last Seen</Tooltip.Header>
    </ExampleTooltip>
  ));

  it.snapshot('left-aligned grid', () => (
    <ExampleTooltip>
      <Tooltip.Grid>
        <Tooltip.Row>
          <Text size="sm">Short</Text>
        </Tooltip.Row>
        <Tooltip.Row>
          <Text size="sm">A longer row label</Text>
        </Tooltip.Row>
      </Tooltip.Grid>
    </ExampleTooltip>
  ));

  it.snapshot('header grid and footer', () => (
    <ExampleTooltip maxWidth={320}>
      <LastSeenCard />
    </ExampleTooltip>
  ));
});
