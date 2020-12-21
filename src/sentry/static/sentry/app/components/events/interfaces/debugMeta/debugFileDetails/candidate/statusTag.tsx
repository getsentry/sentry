import React from 'react';

import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {CandiateDownloadStatus} from 'app/types/debugImage';

type Props = {
  status: CandiateDownloadStatus;
};

function StatusTag({status}: Props) {
  switch (status) {
    case CandiateDownloadStatus.OK: {
      return <Tag type="success">{t('Successful')}</Tag>;
    }
    case CandiateDownloadStatus.MALFORMED: {
      return <Tag type="error">{t('Failed')}</Tag>;
    }
    case CandiateDownloadStatus.NOT_FOUND: {
      return <Tag>{t('Not Found')}</Tag>;
    }
    case CandiateDownloadStatus.NO_PERMISSION: {
      return <Tag type="warning">{t('Permission')}</Tag>;
    }
    default:
      return <Tag type="highlight">{t('Not applied')}</Tag>;
  }
}

export default StatusTag;
