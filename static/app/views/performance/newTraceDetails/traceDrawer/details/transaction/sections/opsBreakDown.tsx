import {useState} from 'react';

import type {OpBreakdownType} from 'sentry/components/events/opsBreakdown';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function OpsBreakdown({breakdown}: {breakdown: OpBreakdownType}) {
  const [showingAll, setShowingAll] = useState(false);

  const renderText = showingAll ? t('Show less') : t('Show more') + '...';

  return (
    breakdown && (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space(0.25),
          paddingTop: `${space(0.5)} 0`,
        }}
      >
        {breakdown.slice(0, showingAll ? breakdown.length : 5).map(currOp => {
          const {name, percentage, totalInterval} = currOp;

          const operationName = typeof name === 'string' ? name : t('Other');
          const pctLabel = isFinite(percentage) ? Math.round(percentage * 100) : '∞';

          return (
            <div key={operationName}>
              {operationName}:{' '}
              <PerformanceDuration seconds={totalInterval} abbreviation /> ({pctLabel}%)
            </div>
          );
        })}
        {breakdown.length > 5 && (
          <a onClick={() => setShowingAll(prev => !prev)}>{renderText}</a>
        )}
      </div>
    )
  );
}
