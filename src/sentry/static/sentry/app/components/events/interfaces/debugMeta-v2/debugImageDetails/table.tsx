import React from 'react';
import styled from '@emotion/styled';

import ClipboardTooltip from 'app/components/clipboardTooltip';
import ExternalLink from 'app/components/links/externalLink';
import PanelTable from 'app/components/panels/panelTable';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import {
  CandidateDownload,
  CandidateDownloadStatus,
  CandidateFeatures,
  Image,
} from 'app/types/debugImage';

import NotAvailable from '../notAvailable';
import Processing, {ProcessingType} from '../processing';

import Feature from './candidate/feature';
import ProcessingIcon from './candidate/processingIcon';
import Status from './candidate/status';
import Actions from './actions';
import {INTERNAL_SOURCE, onCopy} from './utils';

type Props = {
  candidates: Image['candidates'];
  organization: Organization;
  projectId: Project['id'];
  baseUrl: string;
  builtinSymbolSources: Array<BuiltinSymbolSource> | null;
  onDelete: (debugId: string) => void;
  isLoading: boolean;
};

function Table({
  candidates,
  organization,
  projectId,
  baseUrl,
  builtinSymbolSources,
  onDelete,
  isLoading,
}: Props) {
  function renderProcessing(download: CandidateDownload) {
    const processingItems: React.ComponentProps<typeof Processing>['items'] = [];

    if (download.status !== CandidateDownloadStatus.OK) {
      return <NotAvailable />;
    }

    if (download.unwind) {
      processingItems.push({
        type: ProcessingType.SYMBOLICATION,
        icon: <ProcessingIcon processingInfo={download.unwind} />,
      });
    }

    if (download.debug) {
      processingItems.push({
        type: ProcessingType.STACK_UNWINDING,
        icon: <ProcessingIcon processingInfo={download.debug} />,
      });
    }

    return <Processing items={processingItems} />;
  }

  function renderFeatures(download: Image['candidates'][0]['download']) {
    if (download.status !== CandidateDownloadStatus.OK) {
      return <NotAvailable />;
    }

    const features = Object.entries(download.features).filter(([_key, value]) => value);

    if (!features.length) {
      return <NotAvailable />;
    }

    return (
      <Features>
        {Object.entries(download.features)
          .filter(([_key, value]) => value)
          .map(([key]) => (
            <Feature key={key} type={key as keyof CandidateFeatures} />
          ))}
      </Features>
    );
  }

  function getSourceTooltipDescription(source: string) {
    if (source === INTERNAL_SOURCE) {
      return t('This debug information file was uploaded via Sentry CLI.');
    }

    if (
      builtinSymbolSources?.find(builtinSymbolSource => builtinSymbolSource.id === source)
    ) {
      return t('This debug information file is from a built-in symbol server.');
    }

    return t('This debug information file is from a custom symbol server.');
  }

  return (
    <Wrapper>
      <Title>
        {t('Debug Files')}
        <QuestionTooltip
          title={tct(
            'These are the Debug Information Files (DIFs) corresponding to this image which have been looked up on [docLink:symbol servers] during the processing of the stacktrace.',
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
          t('Processing'),
          t('Features'),
          t('Actions'),
        ]}
        isEmpty={!candidates.length}
        isLoading={isLoading}
      >
        {candidates.map((candidate, index) => {
          const {location, download, source_name, source} = candidate;
          const isInternalSource = source === INTERNAL_SOURCE;
          return (
            <React.Fragment key={index}>
              <StatusColumn>
                <Status candidate={candidate} />
              </StatusColumn>

              <DebugFileColumn>
                <Tooltip title={getSourceTooltipDescription(source)}>
                  <SourceName>{source_name ?? t('Unknown')}</SourceName>
                </Tooltip>
                {location && !isInternalSource && (
                  <ClipboardTooltip title={location} onSuccess={() => onCopy(location)}>
                    <Location>{location}</Location>
                  </ClipboardTooltip>
                )}
              </DebugFileColumn>

              <ProcessingColumn>{renderProcessing(download)}</ProcessingColumn>

              <FeaturesColumn>{renderFeatures(download)}</FeaturesColumn>

              <ActionsColumn>
                {isInternalSource && (
                  <Actions
                    onDelete={onDelete}
                    baseUrl={baseUrl}
                    projectId={projectId}
                    organization={organization}
                    candidate={candidate}
                  />
                )}
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

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: max-content minmax(185px, 1.5fr) 1fr 1fr;

  > *:nth-child(5n) {
    padding: 0;
    display: none;
  }

  > *:nth-child(5n-1),
  > *:nth-child(5n) {
    text-align: right;
    justify-content: flex-end;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    overflow: visible;

    > *:nth-child(5n-1) {
      text-align: left;
      justify-content: flex-start;
    }

    > *:nth-child(5n) {
      padding: ${space(2)};
      display: flex;
    }

    grid-template-columns: max-content minmax(185px, 1.5fr) 1fr 1fr max-content;
  }
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
  color: ${p => p.theme.textColor};
  width: 100%;
`;

const Location = styled(TextOverflow)`
  color: ${p => p.theme.gray300};
  width: 100%;
`;

// Actions Column
const ActionsColumn = styled(StatusColumn)``;

// Processing Column
const ProcessingColumn = styled(StatusColumn)``;

// Features Column
const FeaturesColumn = styled(StatusColumn)``;

const Features = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;
