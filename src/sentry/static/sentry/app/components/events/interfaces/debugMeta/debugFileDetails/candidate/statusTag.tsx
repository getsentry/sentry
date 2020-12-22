import React from 'react';

import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {CandidateDownloadStatus} from 'app/types/debugImage';

type Props = {
  status: CandidateDownloadStatus;
};

function StatusTag({status}: Props) {
  switch (status) {
    case CandidateDownloadStatus.OK: {
      return <Tag type="success">{t('Successful')}</Tag>;
    }
    case CandidateDownloadStatus.MALFORMED: {
      return <Tag type="error">{t('Failed')}</Tag>;
    }
    case CandidateDownloadStatus.NOT_FOUND: {
      return <Tag>{t('Not Found')}</Tag>;
    }
    case CandidateDownloadStatus.NO_PERMISSION: {
      return <Tag type="warning">{t('Permission')}</Tag>;
    }
    case CandidateDownloadStatus.DELETED: {
      return <Tag type="error">{t('Deleted')}</Tag>;
    }
    default:
      return <Tag type="highlight">{t('Not applied')}</Tag>;
  }
}

export default StatusTag;
