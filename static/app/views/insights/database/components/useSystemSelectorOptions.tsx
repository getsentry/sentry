import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import type {SelectOption} from 'sentry/components/compactSelect';
import {space} from 'sentry/styles/space';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {
  DATABASE_SYSTEM_TO_LABEL,
  SupportedDatabaseSystem,
} from 'sentry/views/insights/database/utils/constants';
import {SpanMetricsField} from 'sentry/views/insights/types';

export function useSystemSelectorOptions() {
  const [selectedSystem, setSelectedSystem] = useLocalStorageState<string>(
    'insights-db-system-selector',
    ''
  );

  const {data, isPending, isError} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({'span.op': 'db'}),

      fields: [SpanMetricsField.SPAN_SYSTEM, 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.starfish.database-system-selector'
  );

  const options: SelectOption<string>[] = [];
  data.forEach(entry => {
    const system = entry['span.system'];
    if (system) {
      let label: ReactNode = '';
      const textValue =
        system in DATABASE_SYSTEM_TO_LABEL ? DATABASE_SYSTEM_TO_LABEL[system] : system;

      const supportedSystemSet: Set<string> = new Set(
        Object.values(SupportedDatabaseSystem)
      );

      if (system === SupportedDatabaseSystem.MONGODB) {
        label = (
          <LabelContainer>
            {textValue}
            <StyledFeatureBadge type={'beta'} />
          </LabelContainer>
        );
      } else {
        label = textValue;
      }

      if (supportedSystemSet.has(system)) {
        options.push({value: system, label, textValue});
      }
    }
  });

  // Edge case: Invalid DB system was retrieved from localStorage
  if (!options.find(option => selectedSystem === option.value) && options.length > 0) {
    setSelectedSystem(options[0].value);
  }

  // Edge case: No current system is saved in localStorage
  if (!selectedSystem && options.length > 0) {
    setSelectedSystem(options[0].value);
  }

  return {selectedSystem, setSelectedSystem, options, isLoading: isPending, isError};
}

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: ${space(1)};
`;

const LabelContainer = styled('div')`
  display: flex;
  align-items: center;
`;
