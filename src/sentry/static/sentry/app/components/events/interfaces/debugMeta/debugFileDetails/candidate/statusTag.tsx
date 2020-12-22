import React from 'react';

import Tag from 'app/components/tag';
import {t} from 'app/locale';
import {Candidate, CandidateDownloadStatus} from 'app/types/debugImage';

import {INTERNAL_SOURCE} from '../utils';

import StatusTagTooltip from './statusTagTooltip';

type Props = {
  candidate: Candidate;
};

function StatusTag({candidate}: Props) {
  const {download, location, source} = candidate;

  switch (download.status) {
    case CandidateDownloadStatus.OK: {
      return (
        <StatusTagTooltip
          label={t('Download Details')}
          description={location}
          disabled={!location || source === INTERNAL_SOURCE}
        >
          <Tag type="success">{t('Successful')}</Tag>
        </StatusTagTooltip>
      );
    }
    case CandidateDownloadStatus.MALFORMED: {
      const {details} = download;
      return (
        <StatusTagTooltip
          label={t('Download Details')}
          description={details}
          disabled={!details}
        >
          <Tag type="error">{t('Failed')}</Tag>
        </StatusTagTooltip>
      );
    }
    case CandidateDownloadStatus.NOT_FOUND: {
      const {details} = download;
      return (
        <StatusTagTooltip
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
        </StatusTagTooltip>
      );
    }
    case CandidateDownloadStatus.NO_PERMISSION: {
      const {details} = download;
      return (
        <StatusTagTooltip
          label={t('Permission Error')}
          description={details}
          disabled={!details}
        >
          <Tag type="warning">{t('Permissions')}</Tag>
        </StatusTagTooltip>
      );
    }
    case CandidateDownloadStatus.DELETED: {
      return (
        <StatusTagTooltip
          label={t('This file was deleted after the issue was processed.')}
        >
          <Tag type="error">{t('Deleted')}</Tag>
        </StatusTagTooltip>
      );
    }
    case CandidateDownloadStatus.UNAPPLIED: {
      return (
        <StatusTagTooltip
          label={t(
            'This issue was processed before this debug information file was available. To apply new debug information, reprocess this issue. '
          )}
        >
          <Tag type="highlight">{t('Unapplied')}</Tag>
        </StatusTagTooltip>
      );
    }
    default:
      return <Tag>{t('Unknown')}</Tag>; // This should not happen
  }
}

export default StatusTag;
