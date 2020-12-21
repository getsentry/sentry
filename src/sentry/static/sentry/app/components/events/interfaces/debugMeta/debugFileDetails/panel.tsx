import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import Access from 'app/components/acl/access';
import Role from 'app/components/acl/role';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import PanelTable from 'app/components/panels/panelTable';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconDelete, IconDownload} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {CandiateDownloadStatus, Image} from 'app/types/debugImage';

import StacktraceStatusIcon from './candidate/stacktraceStatusIcon';
import StatusTag from './candidate/statusTag';
import NotAvailable from './notAvailable';

type Props = {
  title: string;
  description: string;
  api: Client;
  candidates: Image['candidates'];
  projectId: Project['id'];
  organization: Organization;
  emptyMessage: string;
  onDelete?: (debugId: string) => void;
};

function Panel({
  title,
  description,
  candidates,
  projectId,
  emptyMessage,
  organization,
  onDelete,
  api,
}: Props) {
  function renderStacktraces(download: Image['candidates'][0]['download']) {
    if (
      download.status === CandiateDownloadStatus.OK &&
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
    if (download.status === CandiateDownloadStatus.OK) {
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
        headers={[t('Status'), t('Debug File'), t('Stacktrace'), t('Features'), ' ']}
        isEmpty={!candidates.length}
        emptyMessage={emptyMessage}
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
                <Tooltip title={location} disabled={!location} isHoverable>
                  <Location>{location}</Location>
                </Tooltip>
              </DebugFileColumn>

              <StacktraceColumn>{renderStacktraces(download)}</StacktraceColumn>

              <FeaturesColumn>{renderFeatures(download)}</FeaturesColumn>

              <ActionsColumn>
                {onDelete && (
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
                            href={`${api.baseUrl}/projects/${organization.slug}/${projectId}/files/dsyms/?id=${location}`}
                            disabled={!hasRole}
                          >
                            {t('Download')}
                          </Button>
                        </Tooltip>
                      )}
                    </Role>
                    <Access access={['project:write']} organization={organization}>
                      {() => (
                        <Tooltip
                          // disabled={hasAccess}
                          // title={t('You do not have permission to delete debug files.')}
                          title={t('Deletion is not yet available')}
                        >
                          <Confirm
                            confirmText={t('Delete')}
                            message={t('Are you sure you wish to delete this file?')}
                            onConfirm={() => onDelete(location)}
                            // disabled={!hasAccess}
                            disabled
                          >
                            <Button
                              priority="danger"
                              icon={<IconDelete size="xs" />}
                              size="xsmall"
                              // disabled={!hasAccess}
                              disabled
                            />
                          </Confirm>
                        </Tooltip>
                      )}
                    </Access>
                  </ButtonBar>
                )}
              </ActionsColumn>
            </React.Fragment>
          );
        })}
      </StyledPanelTable>
    </Wrapper>
  );
}

export default Panel;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
`;

// TODO(PRISCILA): Make it looks better on smaller devices (still to be decided by Robin)
const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 112px minmax(185px, 1fr) 257px 245px 68px;
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
