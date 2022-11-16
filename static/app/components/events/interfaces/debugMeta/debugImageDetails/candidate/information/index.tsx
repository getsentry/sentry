import {Fragment} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import moment from 'moment-timezone';

import DateTime from 'sentry/components/dateTime';
import FileSize from 'sentry/components/fileSize';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  CandidateDownloadStatus,
  ImageCandidate,
  ImageCandidateInternalOk,
  ImageCandidateOk,
  ImageCandidateUnApplied,
  SymbolType,
} from 'sentry/types/debugImage';

import ProcessingItem from '../../../processing/item';
import ProcessingList from '../../../processing/list';
import {INTERNAL_SOURCE} from '../../utils';

import Divider from './divider';
import Features from './features';
import ProcessingIcon from './processingIcon';

type Props = {
  candidate: ImageCandidate;
  hasReprocessWarning: boolean;
  isInternalSource: boolean;
  eventDateReceived?: string;
};

function Information({
  candidate,
  isInternalSource,
  hasReprocessWarning,
  eventDateReceived,
}: Props) {
  const {source_name, source, location, download} = candidate;

  function getFilenameOrLocation() {
    if (
      candidate.download.status === CandidateDownloadStatus.UNAPPLIED ||
      (candidate.download.status === CandidateDownloadStatus.OK && isInternalSource)
    ) {
      const {symbolType, filename} = candidate as
        | ImageCandidateUnApplied
        | ImageCandidateInternalOk;

      return symbolType === SymbolType.PROGUARD && filename === 'proguard-mapping'
        ? null
        : filename;
    }

    if (location && !isInternalSource) {
      return location;
    }

    return null;
  }

  function getTimeSinceData(dateCreated: string) {
    const dateTime = <DateTime date={dateCreated} />;

    if (candidate.download.status !== CandidateDownloadStatus.UNAPPLIED) {
      return {
        tooltipDesc: dateTime,
        displayIcon: false,
      };
    }

    const uploadedBeforeEvent = moment(dateCreated).isBefore(eventDateReceived);

    if (uploadedBeforeEvent) {
      if (hasReprocessWarning) {
        return {
          tooltipDesc: (
            <Fragment>
              {tct(
                'This debug file was uploaded [when] before this event. It takes up to 1 hour for new files to propagate. To apply new debug information, reprocess this issue.',
                {
                  when: moment(eventDateReceived).from(dateCreated, true),
                }
              )}
              <DateTimeWrapper>{dateTime}</DateTimeWrapper>
            </Fragment>
          ),
          displayIcon: true,
        };
      }

      const uplodadedMinutesDiff = moment(eventDateReceived).diff(dateCreated, 'minutes');

      if (uplodadedMinutesDiff >= 60) {
        return {
          tooltipDesc: dateTime,
          displayIcon: false,
        };
      }

      return {
        tooltipDesc: (
          <Fragment>
            {tct(
              'This debug file was uploaded [when] before this event. It takes up to 1 hour for new files to propagate.',
              {
                when: moment(eventDateReceived).from(dateCreated, true),
              }
            )}
            <DateTimeWrapper>{dateTime}</DateTimeWrapper>
          </Fragment>
        ),
        displayIcon: true,
      };
    }

    if (hasReprocessWarning) {
      return {
        tooltipDesc: (
          <Fragment>
            {tct(
              'This debug file was uploaded [when] after this event. To apply new debug information, reprocess this issue.',
              {
                when: moment(dateCreated).from(eventDateReceived, true),
              }
            )}
            <DateTimeWrapper>{dateTime}</DateTimeWrapper>
          </Fragment>
        ),
        displayIcon: true,
      };
    }

    return {
      tooltipDesc: (
        <Fragment>
          {tct('This debug file was uploaded [when] after this event.', {
            when: moment(eventDateReceived).from(dateCreated, true),
          })}
          <DateTimeWrapper>{dateTime}</DateTimeWrapper>
        </Fragment>
      ),
      displayIcon: true,
    };
  }

  function renderProcessingInfo() {
    if (
      candidate.download.status !== CandidateDownloadStatus.OK &&
      candidate.download.status !== CandidateDownloadStatus.DELETED
    ) {
      return null;
    }

    const items: React.ComponentProps<typeof ProcessingList>['items'] = [];

    const {debug, unwind} = candidate as ImageCandidateOk;

    if (debug) {
      items.push(
        <ProcessingItem
          key="symbolication"
          type="symbolication"
          icon={<ProcessingIcon processingInfo={debug} />}
        />
      );
    }

    if (unwind) {
      items.push(
        <ProcessingItem
          key="stack_unwinding"
          type="stack_unwinding"
          icon={<ProcessingIcon processingInfo={unwind} />}
        />
      );
    }

    if (!items.length) {
      return null;
    }

    return (
      <Fragment>
        <StyledProcessingList items={items} />
        <Divider />
      </Fragment>
    );
  }

  function renderExtraDetails() {
    if (
      (candidate.download.status !== CandidateDownloadStatus.UNAPPLIED &&
        candidate.download.status !== CandidateDownloadStatus.OK) ||
      source !== INTERNAL_SOURCE
    ) {
      return null;
    }

    const {symbolType, fileType, cpuName, size, dateCreated} = candidate as
      | ImageCandidateInternalOk
      | ImageCandidateUnApplied;

    const {tooltipDesc, displayIcon} = getTimeSinceData(dateCreated);

    return (
      <Fragment>
        <Tooltip title={tooltipDesc}>
          <TimeSinceWrapper>
            {displayIcon && <IconWarning color="errorText" size="xs" />}
            {tct('Uploaded [timesince]', {
              timesince: <TimeSince disabledAbsoluteTooltip date={dateCreated} />,
            })}
          </TimeSinceWrapper>
        </Tooltip>
        <Divider />
        <FileSize bytes={size} />
        <Divider />
        <span>
          {symbolType === SymbolType.PROGUARD && cpuName === 'any'
            ? t('proguard mapping')
            : `${symbolType}${fileType ? ` ${fileType}` : ''}`}
        </span>
        <Divider />
      </Fragment>
    );
  }

  const filenameOrLocation = getFilenameOrLocation();

  return (
    <Wrapper>
      <div>
        <strong data-test-id="source-name">
          {source_name ? capitalize(source_name) : t('Unknown')}
        </strong>
        {filenameOrLocation && (
          <FilenameOrLocation data-test-id="filename-or-location">
            {filenameOrLocation}
          </FilenameOrLocation>
        )}
      </div>
      <Details>
        {renderExtraDetails()}
        {renderProcessingInfo()}
        <Features download={download} />
      </Details>
    </Wrapper>
  );
}

export default Information;

const Wrapper = styled('div')`
  white-space: pre-wrap;
  word-break: break-all;
  max-width: 100%;
`;

const FilenameOrLocation = styled('span')`
  padding-left: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Details = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: ${space(1)};
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const TimeSinceWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: ${space(0.5)};
  font-variant-numeric: tabular-nums;
`;

const DateTimeWrapper = styled('div')`
  padding-top: ${space(1)};
  font-variant-numeric: tabular-nums;
`;

const StyledProcessingList = styled(ProcessingList)`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: ${space(1)};
`;
