import type React from 'react';
import {Fragment} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';

export function SnapshotsToolbar({
  toggle,
  sortDropdown,
  progressIndicator,
  diffControls,
  soloDiffToggle,
}: {
  toggle: React.ReactNode;
  diffControls?: React.ReactNode;
  progressIndicator?: React.ReactNode;
  soloDiffToggle?: React.ReactNode;
  sortDropdown?: React.ReactNode;
}) {
  return (
    <Fragment>
      <Flex
        align="center"
        justify="between"
        gap="md"
        padding="md xl md 0"
        background="primary"
        onClick={e => e.stopPropagation()}
      >
        <Flex align="center" gap="md">
          {toggle}
          {sortDropdown}
          {progressIndicator}
        </Flex>
        <Flex align="center" gap="md">
          {diffControls && (
            <Flex align="center" gap="sm">
              {diffControls}
            </Flex>
          )}
          {soloDiffToggle}
        </Flex>
      </Flex>
      <Separator orientation="horizontal" />
    </Fragment>
  );
}
