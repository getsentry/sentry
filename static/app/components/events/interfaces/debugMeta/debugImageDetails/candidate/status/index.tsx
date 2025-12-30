import * as Sentry from '@sentry/react';

import {Tag} from 'sentry/components/core/badge/tag';
import {t} from 'sentry/locale';
import {CandidateDownloadStatus} from 'sentry/types/debugImage';

type Props = {
  status: CandidateDownloadStatus;
};

function Status({status, ...props}: Props) {
  switch (status) {
    case CandidateDownloadStatus.OK: {
      return (
        <Tag variant="success" {...props}>
          {t('Ok')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.ERROR:
    case CandidateDownloadStatus.MALFORMED: {
      return (
        <Tag variant="danger" {...props}>
          {t('Failed')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.NOT_FOUND: {
      return (
        <Tag variant="muted" {...props}>
          {t('Not Found')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.NO_PERMISSION: {
      return (
        <Tag variant="info" {...props}>
          {t('Permissions')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.DELETED: {
      return (
        <Tag variant="success" {...props}>
          {t('Deleted')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.UNAPPLIED: {
      return (
        <Tag variant="warning" {...props}>
          {t('Unapplied')}
        </Tag>
      );
    }
    default: {
      Sentry.withScope(scope => {
        scope.setLevel('warning');
        Sentry.captureException(new Error('Unknown image candidate download status'));
      });
      return (
        <Tag variant="muted" {...props}>
          {t('Unknown')}
        </Tag>
      ); // This shall not happen
    }
  }
}

export default Status;
