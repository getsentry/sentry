import type {ComponentProps} from 'react';
import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {Polarity} from 'sentry/components/percentChange';
import {space} from 'sentry/styles/space';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import type {SpanProperty} from 'sentry/views/insights/types';

type TableData = {
  data: Array<Record<string, any>>;
  meta?: MetaType;
};

interface BlockProps {
  dataKey: string | ((data?: TableData['data']) => number | undefined);
  title: string;
  unit: ComponentProps<typeof MetricReadout>['unit'];
  allowZero?: boolean;
  preferredPolarity?: Polarity;
}

export function MobileMetricsRibbon({
  filters,
  blocks,
  fields,
  referrer,
}: {
  blocks: BlockProps[];
  fields: SpanProperty[];
  referrer: string;
  filters?: string[];
}) {
  const {primaryRelease, isLoading: isReleasesLoading} = useReleaseSelection();

  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const queryString = useMemo(() => {
    const searchQuery = new MutableSearch([...(filters ?? [])]);

    if (isProjectCrossPlatform) {
      searchQuery.addFilterValue('os.name', selectedPlatform);
    }

    return appendReleaseFilters(searchQuery, primaryRelease);
  }, [filters, isProjectCrossPlatform, primaryRelease, selectedPlatform]);

  const {isPending, data, meta} = useSpans(
    {
      fields,
      search: queryString,
      enabled: !isReleasesLoading,
    },
    referrer
  );

  return (
    <StyledReadoutRibbon>
      {blocks.map(({title, dataKey, unit, preferredPolarity}) => (
        <MetricsBlock
          key={title}
          title={title}
          unit={unit}
          dataKey={dataKey}
          data={{data, meta}}
          isLoading={isPending}
          preferredPolarity={preferredPolarity}
        />
      ))}
    </StyledReadoutRibbon>
  );
}

const StyledReadoutRibbon = styled(ReadoutRibbon)`
  margin-bottom: ${space(2)};
`;

function MetricsBlock({
  title,
  unit,
  data,
  dataKey,
  isLoading,
  allowZero,
  preferredPolarity,
}: {
  data: TableData;
  isLoading: boolean;
  title: string;
  release?: string;
} & BlockProps) {
  const value =
    typeof dataKey === 'function'
      ? dataKey(data.data)
      : (data?.data?.[0]?.[dataKey] as number);

  const hasData = (value && value !== 0) || (value === 0 && allowZero);

  return (
    <MetricReadout
      title={title}
      value={hasData ? value : undefined}
      isLoading={isLoading}
      unit={unit}
      preferredPolarity={preferredPolarity}
    />
  );
}
