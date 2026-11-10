import {useTheme} from '@emotion/react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {defined} from 'sentry/utils/defined';

import {
  ActivityLineContent,
  ActivityLineList,
  ActivityLineRow,
} from './activityLineItem/layout';

interface TimelineItemProps {
  headline: React.ReactNode;
  marker: React.ReactNode;
  children?: React.ReactNode;
  variant?: 'default' | 'card';
}

function Item({marker, headline, children, variant = 'default'}: TimelineItemProps) {
  const theme = useTheme();
  if (variant === 'card') {
    return (
      <ActivityLineRow>
        <Stack
          column="1 / -1"
          position="relative"
          left={`-${theme.space.lg}`}
          width={`calc(100% + ${theme.space.lg})`}
          padding="lg"
          gap="lg"
          border="primary"
          radius="md"
          background="primary"
        >
          <Grid columns="24px minmax(0, 1fr)" align="center" gap="sm">
            {marker}
            {headline}
          </Grid>
          {children}
        </Stack>
      </ActivityLineRow>
    );
  }

  return (
    <ActivityLineRow>
      <Container column={1} row={1}>
        {marker}
      </Container>
      <Flex column={2} row={1} minWidth={0} minHeight="22px" align="center">
        {headline}
      </Flex>
      {defined(children) && <ActivityLineContent>{children}</ActivityLineContent>}
    </ActivityLineRow>
  );
}

export const Timeline = {Container: ActivityLineList, Item};
