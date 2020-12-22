import React from 'react';
import styled from '@emotion/styled';

import PanelTable from 'app/components/panels/panelTable';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {CandidateDownloadStatus, Image} from 'app/types/debugImage';

import StacktraceStatusIcon from './candidate/stacktraceStatusIcon';
import StatusTag from './candidate/statusTag';
import NotAvailable from './notAvailable';

type Props = {
  title: string;
  description: string;
  candidates: Image['candidates'];
  emptyMessage: string;
  isLoading?: boolean;
  actions?: ({debugId: string, deleted: boolean}) => React.ReactElement;
};

function Table({
  title,
  description,
  candidates,
  emptyMessage,
  isLoading,
  actions,
}: Props) {
  function renderStacktraces(download: Image['candidates'][0]['download']) {
    if (
      download.status === CandidateDownloadStatus.OK &&
      (download.unwind || download.debug)
    ) {
      const stacktraces: Array<React.ReactElement> = [];

      if (download.unwind) {
        stacktraces.push(
          <Stacktrace>
            <StacktraceStatusIcon stacktraceInfo={download.unwind} />
            {t('Stack unwinding')}
          </Stacktrace>
        );
      }

      if (download.debug) {
        stacktraces.push(
          <Stacktrace>
            <StacktraceStatusIcon stacktraceInfo={download.debug} />
            {t('Symbolication')}
          </Stacktrace>
        );
      }

      return <Stacktraces>{stacktraces}</Stacktraces>;
    }

    return <NotAvailable />;
  }

  function renderFeatures(download: Image['candidates'][0]['download']) {
    if (download.status === CandidateDownloadStatus.OK) {
      const features = Object.entries(download.features).filter(([_key, value]) => value);

      if (!!features.length) {
        return (
          <Features>
            {Object.entries(download.features)
              .filter(([_key, value]) => value)
              .map(([key]) => (
                <Feature key={key}>{key.split('_')[1]}</Feature>
              ))}
          </Features>
        );
      }

      return <NotAvailable />;
    }

    return <NotAvailable />;
  }

  return (
    <Wrapper>
      <Title>
        {title}
        <QuestionTooltip title={description} size="xs" position="top" />
      </Title>
      <StyledPanelTable
        headers={[t('Status'), t('Location'), t('Stacktrace'), t('Features'), ' ']}
        isEmpty={!candidates.length}
        emptyMessage={emptyMessage}
        isLoading={isLoading}
      >
        {candidates.map(({location, download, source}) => {
          const {status} = download;
          return (
            <React.Fragment key={location}>
              <StatusColumn>
                <StatusTag status={status} />
              </StatusColumn>

              <DebugFileColumn>
                <SourceName>{source}</SourceName>
                {!actions && location && (
                  <Tooltip title={location} disabled={!location} isHoverable>
                    <Location>{location}</Location>
                  </Tooltip>
                )}
              </DebugFileColumn>

              <StacktraceColumn>{renderStacktraces(download)}</StacktraceColumn>

              <FeaturesColumn>{renderFeatures(download)}</FeaturesColumn>

              <ActionsColumn>
                {actions?.({
                  debugId: location,
                  deleted: status === CandidateDownloadStatus.DELETED,
                }) ?? null}
              </ActionsColumn>
            </React.Fragment>
          );
        })}
      </StyledPanelTable>
    </Wrapper>
  );
}

export default Table;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
`;

// TODO(PRISCILA): Make it looks better on smaller devices (still to be decided by Robin)
const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 112px minmax(185px, 1fr) 257px 245px 160px;
`;

// Table Title
const Title = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  font-weight: 600;
  color: ${p => p.theme.gray400};
`;

// Status Column
const StatusColumn = styled('div')`
  display: flex;
  align-items: center;
`;

// Debug File Info Column
const DebugFileColumn = styled(StatusColumn)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const SourceName = styled(TextOverflow)`
  color: ${p => p.theme.gray500};
`;

const Location = styled(TextOverflow)`
  color: ${p => p.theme.gray300};
`;

// Actions Column
const ActionsColumn = styled(StatusColumn)`
  justify-content: flex-end;
`;

// Stacktrace Column
const StacktraceColumn = styled(StatusColumn)``;

const Stacktraces = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Stacktrace = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(0.75)};
  align-items: center;
`;

// Features Column
const FeaturesColumn = styled(StatusColumn)``;

const Features = styled(Stacktraces)`
  color: ${p => p.theme.gray300};
  grid-column-gap: ${space(1)};
`;

const Feature = styled(Stacktrace)``;
