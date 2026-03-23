import {type ReactNode} from 'react';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

export function SeerOverview({children}: {children: ReactNode}) {
  return (
    <Grid columns="minmax(max-content, 140px) 1fr max-content" gap="xl">
      {children}
    </Grid>
  );
}

function Section({children}: {children?: ReactNode}) {
  return (
    <Grid
      align="center"
      border="primary"
      column="1 / -1"
      columns="subgrid"
      gap="xl lg"
      padding="0 0 md 0"
      radius="md"
    >
      {children}
    </Grid>
  );
}

function SectionHeader({children, title}: {title: string; children?: ReactNode}) {
  return (
    <Flex
      align="baseline"
      background="secondary"
      borderBottom="primary"
      column="1 / -1"
      justify="between"
      padding="md xl"
      radius="md md 0 0"
    >
      <Heading as="h2" size="sm" density="compressed">
        <Text uppercase>{title}</Text>
      </Heading>
      {children}
    </Flex>
  );
}

function Stat({value, label}: {label: string; value: string | number}) {
  return (
    <Stack alignSelf="start" gap="md" padding="0 lg">
      <Text size="md" variant="muted">
        {label}
      </Text>
      <Flex paddingLeft="md" justify="end">
        <Text size="2xl" bold tabular>
          {value}
        </Text>
      </Flex>
    </Stack>
  );
}

function ActionButton({children}: {children: ReactNode}) {
  return (
    <Flex alignSelf="start" align="center" justify="end" paddingRight="lg" gap="lg">
      {children}
    </Flex>
  );
}

function formatStatValue(value: number, outOf: number | undefined, isLoading: boolean) {
  if (isLoading) {
    return '\u2014';
  }
  return outOf === undefined ? value : `${value}\u2009/\u2009${outOf}`;
}

SeerOverview.Section = Section;
SeerOverview.SectionHeader = SectionHeader;
SeerOverview.Stat = Stat;
SeerOverview.ActionButton = ActionButton;
SeerOverview.formatStatValue = formatStatValue;
