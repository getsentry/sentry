import {useTheme} from '@emotion/react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

import {OverviewCardSkeleton, TextLineSkeleton} from './issueCard';
import {GroupHeader, StatusGroup} from './statusGroups';

export function ProjectFilterSkeleton() {
  const theme = useTheme();
  return (
    <Flex aria-hidden>
      <Placeholder height={theme.form.md.height} width="6rem" />
    </Flex>
  );
}

export function OverviewSkeleton() {
  const theme = useTheme();
  return (
    <Stack gap="lg" aria-hidden>
      <Flex align="center" height={theme.form.md.height} marginBottom="xs">
        {['6rem', '7rem'].map((width, tab) => (
          <Container key={tab} padding="0 xl">
            <TextLineSkeleton size="md" width={width} />
          </Container>
        ))}
      </Flex>
      {['8rem', '10rem'].map((width, section) => (
        <StatusGroup key={section} size="sm" expanded>
          <GroupHeader>
            <Disclosure.Title>
              <Placeholder height="1lh" width={width} />
            </Disclosure.Title>
          </GroupHeader>
          <Disclosure.Content>
            <Stack gap="md" paddingTop="sm">
              <OverviewCardSkeleton />
              <OverviewCardSkeleton />
            </Stack>
          </Disclosure.Content>
        </StatusGroup>
      ))}
    </Stack>
  );
}
