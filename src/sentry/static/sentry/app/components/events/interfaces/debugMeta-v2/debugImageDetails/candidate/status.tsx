import React from 'react';

import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {CandidateDownloadStatus, ImageCandidate} from 'app/types/debugImage';

import {INTERNAL_SOURCE} from '../utils';

import StatusTooltip from './statusTooltip';

type Props = {
  candidate: ImageCandidate;
};

function Status({candidate}: Props) {
  const {download, location, source} = candidate;

  switch (download.status) {
    case CandidateDownloadStatus.OK: {
      return (
        <StatusTooltip
          label={t('Download Details')}
          description={location}
          disabled={!location || source === INTERNAL_SOURCE}
        >
          <Tag type="success">{t('Ok')}</Tag>
        </StatusTooltip>
      );
    }
    case CandidateDownloadStatus.MALFORMED: {
      const {details} = download;
      return (
        <StatusTooltip
          label={t('Download Details')}
          description={details}
          disabled={!details}
        >
          <Tag type="error">{t('Failed')}</Tag>
        </StatusTooltip>
      );
    }
    case CandidateDownloadStatus.NOT_FOUND: {
      const {details} = download;
      return (
        <StatusTooltip
          label={
            <React.Fragment>
              {t('No debug file was not found at this location')}
              {':'}
            </React.Fragment>
          }
          description={
            <React.Fragment>
              <div>{location}</div>
              {details && <div>{details}</div>}
            </React.Fragment>
          }
          disabled={!location || source === INTERNAL_SOURCE}
        >
          <Tag>{t('Not Found')}</Tag>
        </StatusTooltip>
      );
    }
    case CandidateDownloadStatus.NO_PERMISSION: {
      const {details} = download;
      return (
        <StatusTooltip
          label={t('Permission Error')}
          description={details}
          disabled={!details}
        >
          <Tag type="warning">{t('Permissions')}</Tag>
        </StatusTooltip>
      );
    }
    case CandidateDownloadStatus.DELETED: {
      return (
        <StatusTooltip label={t('This file was deleted after the issue was processed.')}>
          <Tag type="error">{t('Deleted')}</Tag>
        </StatusTooltip>
      );
    }
    case CandidateDownloadStatus.UNAPPLIED: {
      return (
        <StatusTooltip
          label={t(
            'This issue was processed before this debug information file was available. To apply new debug information, reprocess this issue. '
          )}
        >
          <Tag type="highlight">{t('Unapplied')}</Tag>
        </StatusTooltip>
      );
    }
    default:
      return <Tag>{t('Unknown')}</Tag>; // This should not happen
  }
}

export default Status;
