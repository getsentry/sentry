import React from 'react';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
import moment from 'moment-timezone';

import FileSize from 'app/components/fileSize';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import {IconClock} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import {
  CandidateDownloadStatus,
  ImageCandidate,
  ImageCandidateUnApplied,
} from 'app/types/debugImage';
import {Theme} from 'app/utils/theme';

import {getSourceTooltipDescription} from '../utils';

import Features from './features';

type Props = {
  candidate: ImageCandidate;
  builtinSymbolSources: Array<BuiltinSymbolSource> | null;
  isInternalSource: boolean;
  eventDateCreated: string;
  theme: Theme;
};

function Information({
  candidate,
  builtinSymbolSources,
  isInternalSource,
  eventDateCreated,
  theme,
}: Props) {
  const {source_name, source, location, download} = candidate;

  function getMainInfo() {
    if (candidate.download.status === CandidateDownloadStatus.UNAPPLIED) {
      const {symbolType, filename} = candidate as ImageCandidateUnApplied;

      return symbolType === 'proguard' && filename === 'proguard-mapping'
        ? null
        : filename;
    }

    if (location && !isInternalSource) {
      return location;
    }

    return null;
  }

  function getDetails() {
    if (candidate.download.status !== CandidateDownloadStatus.UNAPPLIED) {
      return (
        <Tooltip title={getSourceTooltipDescription(source, builtinSymbolSources)}>
          <strong>{`${t('Source')}: `}</strong>
          {source_name ?? t('Unknown')}
        </Tooltip>
      );
    }

    const {
      symbolType,
      fileType,
      cpuName,
      size,
      dateCreated,
    } = candidate as ImageCandidateUnApplied;

    const uploadedBeforeEvent = moment(dateCreated).isBefore(eventDateCreated);

    return (
      <React.Fragment>
        <Tooltip title={getSourceTooltipDescription(source, builtinSymbolSources)}>
          <strong>{`${t('Source')}: `}</strong>
          {source_name ?? t('Unknown')}
        </Tooltip>
        <ExtraDetails>
          <TimeWrapper color={uploadedBeforeEvent ? theme.orange300 : theme.error}>
            <IconClock size="xs" />
            <TimeSince
              date={dateCreated}
              tooltipTitle={
                <RelativeTime>
                  {uploadedBeforeEvent
                    ? tct(
                        'This debug file was uploaded [when] before this event. To apply new debug information, reprocess this issue.',
                        {
                          when: moment(eventDateCreated).from(dateCreated, true),
                        }
                      )
                    : tct(
                        'This debug file was uploaded [when] after this event. To apply new debug information, reprocess this issue.',
                        {
                          when: moment(dateCreated).from(eventDateCreated, true),
                        }
                      )}
                </RelativeTime>
              }
            />
          </TimeWrapper>
          {'|'}
          <FileSize bytes={size} />
          {'|'}
          <span>
            {symbolType === 'proguard' && cpuName === 'any'
              ? t('proguard mapping')
              : `${symbolType}${fileType ? ` ${fileType}` : ''}`}
          </span>
        </ExtraDetails>
      </React.Fragment>
    );
  }

  return (
    <Wrapper>
      {getMainInfo()}
      <Details>{getDetails()}</Details>
      <Features download={download} />
    </Wrapper>
  );
}

export default withTheme(Information);

const Wrapper = styled('div')`
  white-space: pre-wrap;
  word-break: break-all;
  max-width: 100%;
`;

const Details = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  > * :first-child {
    margin-right: ${space(2)};
  }
`;

const ExtraDetails = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

const TimeWrapper = styled('div')<{color?: string}>`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: min-content 1fr;
  align-items: center;
  ${p => p.color && `color: ${p.color}`};
`;

const RelativeTime = styled('div')`
  padding-bottom: ${space(0.5)};
`;
