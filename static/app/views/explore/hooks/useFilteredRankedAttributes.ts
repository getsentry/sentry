import {useEffect, useMemo, useState} from 'react';

import type {AttributeBreakdownsComparison} from 'sentry/views/explore/hooks/useAttributeBreakdownComparison';

type RankedAttribute = AttributeBreakdownsComparison['rankedAttributes'][number];

export function useFilteredRankedAttributes({
  rankedAttributes,
  searchQuery,
  pageSize,
}: {
  pageSize: number;
  rankedAttributes: RankedAttribute[] | undefined;
  searchQuery: string;
}) {
  const [page, setPage] = useState(0);

  const filteredRankedAttributes = useMemo(() => {
    if (!rankedAttributes) {
      return [];
    }

    let filtered = rankedAttributes;
    const trimmed = searchQuery.toLocaleLowerCase().trim();
    if (trimmed) {
      filtered = rankedAttributes.filter(attr =>
        attr.attributeName.toLocaleLowerCase().trim().includes(trimmed)
      );
    }

    return [...filtered].sort((a, b) => {
      const aOrder = a.order.rrr;
      const bOrder = b.order.rrr;
      if (aOrder === null && bOrder === null) return 0;
      if (aOrder === null) return 1;
      if (bOrder === null) return -1;
      return aOrder - bOrder;
    });
  }, [rankedAttributes, searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [filteredRankedAttributes]);

  const totalPages = Math.ceil(filteredRankedAttributes.length / pageSize);
  const paginatedAttributes = filteredRankedAttributes.slice(
    page * pageSize,
    (page + 1) * pageSize
  );

  return {
    filteredRankedAttributes,
    paginatedAttributes,
    page,
    totalPages,
    hasPrevious: page > 0,
    hasNext: page < totalPages - 1,
    nextPage: () => setPage(p => p + 1),
    previousPage: () => setPage(p => p - 1),
  };
}
