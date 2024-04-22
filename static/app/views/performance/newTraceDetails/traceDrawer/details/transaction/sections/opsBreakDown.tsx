import {useState} from 'react';

import {generateStats} from 'sentry/components/events/opsBreakdown';
import PerformanceDuration from 'sentry/components/performanceDuration';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types';

import {TraceDrawerComponents} from '../../styles';

export function OpsBreakdown({event}: {event: EventTransaction}) {
  const [showingAll, setShowingAll] = useState(false);
  const breakdown = event && generateStats(event, {type: 'no_filter'});

  if (breakdown.length <= 0) {
    return null;
  }

  const renderText = showingAll ? t('Show less') : t('Show more') + '...';

  return (
    breakdown && (
      <TraceDrawerComponents.TableRow
        title={
          <TraceDrawerComponents.FlexBox style={{gap: '5px'}}>
            {t('Ops Breakdown')}
            <QuestionTooltip
              title={t('Applicable to the children of this event only')}
              size="xs"
            />
          </TraceDrawerComponents.FlexBox>
        }
      >
        <div style={{display: 'flex', flexDirection: 'column', gap: space(0.25)}}>
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
      </TraceDrawerComponents.TableRow>
    )
  );
}
