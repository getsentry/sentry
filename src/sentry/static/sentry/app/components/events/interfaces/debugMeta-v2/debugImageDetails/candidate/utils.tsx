import * as Sentry from '@sentry/react';

import {t} from 'app/locale';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import {
  CandidateDownloadStatus,
  CandidateFeatures,
  ImageCandidate,
} from 'app/types/debugImage';

import {INTERNAL_SOURCE} from '../utils';

export function getFeatureLabel(type: keyof CandidateFeatures) {
  switch (type) {
    case 'has_debug_info':
      return {
        label: t('debug'),
        description: t(
          'Debug information provides function names and resolves inlined frames during symbolication'
        ),
      };
    case 'has_sources':
      return {
        label: t('sources'),
        description: t(
          'Source code information allows Sentry to display source code context for stack frames'
        ),
      };
    case 'has_symbols':
      return {
        label: t('symtab'),
        description: t(
          'Symbol tables are used as a fallback when full debug information is not available'
        ),
      };
    case 'has_unwind_info':
      return {
        label: t('unwind'),
        description: t(
          'Stack unwinding information improves the quality of stack traces extracted from minidumps'
        ),
      };
    default: {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(new Error('Unknown image candidate feature'));
      });
      return {}; // this shall not happen
    }
  }
}

export function getSourceTooltipDescription(
  source: string,
  builtinSymbolSources: Array<BuiltinSymbolSource> | null
) {
  if (source === INTERNAL_SOURCE) {
    return t(
      "This debug information file is from Sentry's internal symbol server for this project"
    );
  }

  if (
    builtinSymbolSources?.find(builtinSymbolSource => builtinSymbolSource.id === source)
  ) {
    return t('This debug information file is from a built-in symbol server');
  }

  return t('This debug information file is from a custom symbol server');
}

export function getStatusTooltipDescription(candidate: ImageCandidate) {
  const {download, location, source} = candidate;

  switch (download.status) {
    case CandidateDownloadStatus.OK: {
      return {
        label: t('Download Details'),
        description: location,
        disabled: !location || source === INTERNAL_SOURCE,
      };
    }

    case CandidateDownloadStatus.ERROR:
    case CandidateDownloadStatus.MALFORMED: {
      const {details} = download;
      return {
        label: t('Download Details'),
        description: details,
        disabled: !details,
      };
    }
    case CandidateDownloadStatus.NOT_FOUND: {
      return {};
    }
    case CandidateDownloadStatus.NO_PERMISSION: {
      const {details} = download;
      return {
        label: t('Permission Error'),
        description: details,
        disabled: !details,
      };
    }
    case CandidateDownloadStatus.DELETED: {
      return {
        label: t('This file was deleted after the issue was processed.'),
      };
    }
    case CandidateDownloadStatus.UNAPPLIED: {
      return {
        label: t(
          'This issue was processed before this debug information file was available. To apply new debug information, reprocess this issue.'
        ),
      };
    }
    default: {
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(new Error('Unknown image candidate download status'));
      });
      return {}; // This shall not happen
    }
  }
}
