import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconClose, IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import type {SummaryFilterKey} from 'sentry/views/prevent/tests/config';

// exporting for testing purposes
export function useCreateSummaryFilterLink(filterBy: SummaryFilterKey | undefined) {
  const location = useLocation();

  if (!filterBy) {
    return {
      isFiltered: false,
      filterLink: location,
    };
  }

  const isFiltered = location.query.filterBy === filterBy;

  const filterLink = {
    ...location,
    query: {
      ...location.query,
      filterBy,
    },
  };

  const revertFilterLink = {
    ...location,
    query: {
      ...location.query,
      filterBy: undefined,
    },
  };

  return {
    isFiltered,
    filterLink: isFiltered ? revertFilterLink : filterLink,
  };
}

interface SummaryCardProps {
  label: string;
  tooltip: ReactNode;
  extra?: ReactNode;
  filterBy?: SummaryFilterKey;
  value?: string | number;
}

export function SummaryCard({label, tooltip, value, filterBy, extra}: SummaryCardProps) {
  const {filterLink, isFiltered} = useCreateSummaryFilterLink(filterBy);

  const filterLabel = isFiltered
    ? t('Clear filter')
    : t('Filter the table to these tests');

  const content = (
    <Fragment>
      <Flex align="center" gap="xs">
        <Heading as="h4" size="sm">
          {label}
        </Heading>
        <QuestionTooltip title={tooltip} size="xs" />
      </Flex>
      <Flex justify="between" align="center">
        <Flex align="center" gap="sm">
          <Text size="2xl" bold variant={filterBy ? 'accent' : undefined}>
            {value ?? '-'}
          </Text>
          {extra}
        </Flex>
        {filterBy && (
          <Button
            size="zero"
            borderless
            icon={isFiltered ? <IconClose /> : <IconFilter />}
            title={filterLabel}
            aria-label={filterLabel}
          />
        )}
      </Flex>
    </Fragment>
  );

  return (
    <SummaryCardContainer
      direction="column"
      padding="md"
      gap="sm"
      isFiltered={isFiltered}
      isClickable={!!filterBy}
    >
      {props =>
        filterBy ? (
          <li>
            <Link to={filterLink} {...props}>
              {content}
            </Link>
          </li>
        ) : (
          <li {...props}> {content}</li>
        )
      }
    </SummaryCardContainer>
  );
}

const SummaryCardContainer = styled(Flex)<{isClickable?: boolean; isFiltered?: boolean}>`
  border: 1px solid
    ${p =>
      p.isFiltered
        ? p.theme.tokens.border.accent.vibrant
        : p.theme.tokens.border.primary};
  background: ${p =>
    p.isFiltered
      ? p.theme.tokens.background.transparent.accent.muted
      : p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};

  ${p =>
    p.isClickable &&
    `
    &:hover {
      background: ${p.theme.tokens.background.secondary};
    }
  `}
`;

interface SummaryCardGroupProps {
  children: ReactNode;
  isLoading: boolean;
  placeholderCount: number;
  title: string;
  trailingHeaderItems?: ReactNode;
}

export function SummaryCardGroup({
  title,
  isLoading,
  placeholderCount,
  children,
  trailingHeaderItems,
}: SummaryCardGroupProps) {
  return (
    <Flex
      gap="lg"
      direction="column"
      padding="xl"
      background="secondary"
      radius="md"
      as="section"
    >
      <Flex justify="between" align="center" gap="md">
        <Heading as="h4" size="lg">
          {title}
        </Heading>
        {trailingHeaderItems}
      </Flex>
      <SummaryListGrid
        columns="repeat(auto-fit, minmax(200px, 1fr))"
        align="start"
        gap="md"
        as="ul"
      >
        {isLoading
          ? Array.from({length: placeholderCount}, (_, index) => (
              <Placeholder key={index} height="66px" />
            ))
          : children}
      </SummaryListGrid>
    </Flex>
  );
}

const SummaryListGrid = styled(Grid)`
  margin: 0;
  padding: 0;
  list-style: none;
`;
