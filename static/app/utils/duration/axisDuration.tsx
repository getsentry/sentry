import {t} from 'sentry/locale';
import {DAY, HOUR, MINUTE, SECOND, WEEK} from 'sentry/utils/formatters';

import {categorizeDuration} from '../discover/categorizeDuration';

/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 */
export function axisDuration(milliseconds: number, durationUnit?: number): string {
  durationUnit ??= categorizeDuration(milliseconds);
  if (milliseconds === 0) {
    return '0';
  }
  switch (durationUnit) {
    case WEEK: {
      const label = (milliseconds / WEEK).toFixed(0);
      return t('%swk', label);
    }
    case DAY: {
      const label = (milliseconds / DAY).toFixed(0);
      return t('%sd', label);
    }
    case HOUR: {
      const label = (milliseconds / HOUR).toFixed(0);
      return t('%shr', label);
    }
    case MINUTE: {
      const label = (milliseconds / MINUTE).toFixed(0);
      return t('%smin', label);
    }
    case SECOND: {
      const label = (milliseconds / SECOND).toFixed(0);
      return t('%ss', label);
    }
    default:
      const label = milliseconds.toFixed(0);
      return t('%sms', label);
  }
}
