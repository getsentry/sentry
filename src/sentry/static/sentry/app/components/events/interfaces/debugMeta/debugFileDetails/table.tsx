import React from 'react';
import styled from '@emotion/styled';

import Access from 'app/components/acl/access';
import Role from 'app/components/acl/role';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ClipboardTooltip from 'app/components/clipboardTooltip';
import Confirm from 'app/components/confirm';
import ExternalLink from 'app/components/links/externalLink';
import PanelTable from 'app/components/panels/panelTable';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconDelete, IconDownload} from 'app/icons';
import {t, tct} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {CandidateDownloadStatus, Image} from 'app/types/debugImage';

import StacktraceStatusIcon from './candidate/stacktraceStatusIcon';
import StatusTag from './candidate/statusTag';
import NotAvailable from './notAvailable';
import {INTERNAL_SOURCE_NAME, onCopy} from './utils';

type Props = {
  candidates: Image['candidates'];
  organization: Organization;
  projectId: Project['id'];
  baseUrl: string;
  onDelete: (debugId: string) => void;
  isLoading: boolean;
};

function Table({
  candidates,
  organization,
  projectId,
  baseUrl,
  onDelete,
  isLoading,
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

  function renderActions(candidate: Image['candidates'][0]) {
    const {download, location: debugFileId} = candidate;

    if (!debugFileId) {
      return null;
    }

    const {status} = download;
    const deleted = status === CandidateDownloadStatus.DELETED;

    const actions = (
      <ButtonBar gap={0.5}>
        <Role role={organization.debugFilesRole} organization={organization}>
          {({hasRole}) => (
            <Tooltip
              disabled={hasRole}
              title={t('You do not have permission to download debug files.')}
            >
              <Button
                size="xsmall"
                icon={<IconDownload size="xs" />}
                href={`${baseUrl}/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugFileId}`}
                disabled={!hasRole || deleted}
              >
                {t('Download')}
              </Button>
            </Tooltip>
          )}
        </Role>
        <Access access={['project:write']} organization={organization}>
          {({hasAccess}) => (
            <Tooltip
              disabled={hasAccess}
              title={t('You do not have permission to delete debug files.')}
            >
              <Confirm
                confirmText={t('Delete')}
                message={t('Are you sure you wish to delete this file?')}
                onConfirm={() => onDelete(debugFileId)}
                disabled={!hasAccess || deleted}
              >
                <Button
                  priority="danger"
                  icon={<IconDelete size="xs" />}
                  size="xsmall"
                  disabled={!hasAccess || deleted}
                />
              </Confirm>
            </Tooltip>
          )}
        </Access>
      </ButtonBar>
    );

    if (!deleted) {
      return actions;
    }

    return <Tooltip title={t('Actions not available.')}>{actions}</Tooltip>;
  }

  return (
    <Wrapper>
      <Title>
        {t('Debug Files')}
        <QuestionTooltip
          title={tct(
            "These are the Debug Information Files (DIFs) corresponding to this image which have been looked up on [docLink:symbol servers] during the processing of the stacktrace.  Often these DIFs need to be looked up in multiple locations on the symbol server but are only present in one of them so there will be many listed as 'Not Found'",
            {
              docLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/native/data-management/debug-files/#symbol-servers" />
              ),
            }
          )}
          size="xs"
          position="top"
          isHoverable
        />
      </Title>
      <StyledPanelTable
        headers={[
          t('Status'),
          t('Debug File'),
          t('Stacktrace'),
          t('Features'),
          <ActionsColumn key="actions">{t('Actions')}</ActionsColumn>,
        ]}
        isEmpty={!candidates.length}
        isLoading={isLoading}
      >
        {candidates.map((candidate, index) => {
          const {location, download, source_name, source} = candidate;
          const isInternalSource = source === INTERNAL_SOURCE_NAME;
          const {status} = download;
          return (
            <React.Fragment key={index}>
              <StatusColumn>
                <StatusTag status={status} />
              </StatusColumn>

              <DebugFileColumn>
                {source_name ? (
                  <ClipboardTooltip
                    title={source_name}
                    onSuccess={() => onCopy(source_name)}
                  >
                    <SourceName>{source_name}</SourceName>
                  </ClipboardTooltip>
                ) : (
                  <SourceName>{t('Unknown')}</SourceName>
                )}
                {location && !isInternalSource && (
                  <ClipboardTooltip title={location} onSuccess={() => onCopy(location)}>
                    <Location>{location}</Location>
                  </ClipboardTooltip>
                )}
              </DebugFileColumn>

              <StacktraceColumn>{renderStacktraces(download)}</StacktraceColumn>

              <FeaturesColumn>{renderFeatures(download)}</FeaturesColumn>

              <ActionsColumn>
                {isInternalSource ? renderActions(candidate) : null}
              </ActionsColumn>
            </React.Fragment>
          );
        })}
      </StyledPanelTable>
    </Wrapper>
  );
}

export default Table;

Table.propTypes = {
  organization: SentryTypes.Organization,
};

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;

// TODO(PRISCILA): Make it looks better on smaller devices (still to be decided by Robin)
const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: max-content minmax(185px, 0.5fr) 1fr 1fr max-content;
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
  width: 100%;
`;

const Location = styled(TextOverflow)`
  color: ${p => p.theme.gray300};
  width: 100%;
`;

// Actions Column
const ActionsColumn = styled(StatusColumn)`
  justify-content: flex-end;
  text-align: right;
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
