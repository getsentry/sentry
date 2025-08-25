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
        <Tag type="success" {...props}>
          {t('Ok')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.ERROR:
    case CandidateDownloadStatus.MALFORMED: {
      return (
        <Tag type="error" {...props}>
          {t('Failed')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.NOT_FOUND: {
      return <Tag {...props}>{t('Not Found')}</Tag>;
    }
    case CandidateDownloadStatus.NO_PERMISSION: {
      return (
        <Tag type="highlight" {...props}>
          {t('Permissions')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.DELETED: {
      return (
        <Tag type="success" {...props}>
          {t('Deleted')}
        </Tag>
      );
    }
    case CandidateDownloadStatus.UNAPPLIED: {
      return (
        <Tag type="warning" {...props}>
          {t('Unapplied')}
        </Tag>
      );
    }
  }
}

export default Status;
