import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import type {DebugFile} from 'sentry/types/debugFiles';
import {DebugFileFeature} from 'sentry/types/debugFiles';
import type {Image, ImageStatus} from 'sentry/types/debugImage';
import {CandidateDownloadStatus} from 'sentry/types/debugImage';
import type {Event} from 'sentry/types/event';
import {displayReprocessEventAction} from 'sentry/utils/displayReprocessEventAction';
import {useApiQuery} from 'sentry/utils/queryClient';
import theme from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {getPrettyFileType} from 'sentry/views/settings/projectDebugFiles/utils';

import {getFileName} from '../utils';

import Candidates from './candidates';
import GeneralInfo from './generalInfo';
import ReprocessAlert from './reprocessAlert';
import {INTERNAL_SOURCE, INTERNAL_SOURCE_LOCATION} from './utils';

type ImageCandidates = Image['candidates'];

type DebugImageDetailsProps = ModalRenderProps & {
  event: Event;
  organization: Organization;
  projSlug: Project['slug'];
  image?: Image & {status: ImageStatus};
  onReprocessEvent?: () => void;
};

function sortCandidates(
  candidates: ImageCandidates,
  unAppliedCandidates: ImageCandidates
): ImageCandidates {
  const [noPermissionCandidates, restNoPermissionCandidates] = partition(
    candidates,
    candidate => candidate.download.status === CandidateDownloadStatus.NO_PERMISSION
  );

  const [malFormedCandidates, restMalFormedCandidates] = partition(
    restNoPermissionCandidates,
    candidate => candidate.download.status === CandidateDownloadStatus.MALFORMED
  );

  const [errorCandidates, restErrorCandidates] = partition(
    restMalFormedCandidates,
    candidate => candidate.download.status === CandidateDownloadStatus.ERROR
  );

  const [okCandidates, restOKCandidates] = partition(
    restErrorCandidates,
    candidate => candidate.download.status === CandidateDownloadStatus.OK
  );

  const [deletedCandidates, notFoundCandidates] = partition(
    restOKCandidates,
    candidate => candidate.download.status === CandidateDownloadStatus.DELETED
  );

  return [
    ...sortBy(noPermissionCandidates, ['source_name', 'location']),
    ...sortBy(malFormedCandidates, ['source_name', 'location']),
    ...sortBy(errorCandidates, ['source_name', 'location']),
    ...sortBy(okCandidates, ['source_name', 'location']),
    ...sortBy(deletedCandidates, ['source_name', 'location']),
    ...sortBy(unAppliedCandidates, ['source_name', 'location']),
    ...sortBy(notFoundCandidates, ['source_name', 'location']),
  ];
}

function getCandidates({
  debugFiles,
  image,
  isLoading,
}: {
  debugFiles: DebugFile[] | undefined;
  image: DebugImageDetailsProps['image'];
  isLoading: boolean;
}) {
  const {candidates = []} = image ?? {};

  if (!debugFiles || isLoading) {
    return candidates;
  }

  const debugFileCandidates = candidates.map(({location, ...candidate}) => ({
    ...candidate,
    location: location?.includes(INTERNAL_SOURCE_LOCATION)
      ? location.split(INTERNAL_SOURCE_LOCATION)[1]
      : location,
  }));

  const candidateLocations = new Set(
    debugFileCandidates.map(({location}) => location).filter(location => !!location)
  );

  const [unAppliedDebugFiles, appliedDebugFiles] = partition(
    debugFiles,
    debugFile => !candidateLocations.has(debugFile.id)
  );

  const unAppliedCandidates = unAppliedDebugFiles.map(debugFile => {
    const {
      data,
      symbolType,
      objectName: filename,
      id: location,
      size,
      dateCreated,
      cpuName,
    } = debugFile;

    const features = data?.features ?? [];

    return {
      download: {
        status: CandidateDownloadStatus.UNAPPLIED,
        features: {
          has_sources: features.includes(DebugFileFeature.SOURCES),
          has_debug_info: features.includes(DebugFileFeature.DEBUG),
          has_unwind_info: features.includes(DebugFileFeature.UNWIND),
          has_symbols: features.includes(DebugFileFeature.SYMTAB),
        },
      },
      cpuName,
      location,
      filename,
      size,
      dateCreated,
      symbolType,
      fileType: getPrettyFileType(debugFile),
      source: INTERNAL_SOURCE,
      source_name: t('Sentry'),
    };
  });

  const [debugFileInternalOkCandidates, debugFileOtherCandidates] = partition(
    debugFileCandidates,
    debugFileCandidate =>
      debugFileCandidate.download.status === CandidateDownloadStatus.OK &&
      debugFileCandidate.source === INTERNAL_SOURCE
  );

  const convertedDebugFileInternalOkCandidates = debugFileInternalOkCandidates.map(
    debugFileOkCandidate => {
      const internalDebugFileInfo = appliedDebugFiles.find(
        appliedDebugFile => appliedDebugFile.id === debugFileOkCandidate.location
      );

      if (!internalDebugFileInfo) {
        return {
          ...debugFileOkCandidate,
          download: {
            ...debugFileOkCandidate.download,
            status: CandidateDownloadStatus.DELETED,
          },
        };
      }

      const {
        symbolType,
        objectName: filename,
        id: location,
        size,
        dateCreated,
      } = internalDebugFileInfo;

      return {
        ...debugFileOkCandidate,
        location,
        filename,
        size,
        dateCreated,
        symbolType,
        prettyFileType: getPrettyFileType(internalDebugFileInfo),
      };
    }
  );

  return sortCandidates(
    [
      ...convertedDebugFileInternalOkCandidates,
      ...debugFileOtherCandidates,
    ] as ImageCandidates,
    unAppliedCandidates as ImageCandidates
  );
}

export function DebugImageDetails({
  image,
  projSlug,
  Header,
  Body,
  Footer,
  event,
  onReprocessEvent,
}: DebugImageDetailsProps) {
  const organization = useOrganization();
  const api = useApi();
  const hasUploadedDebugFiles =
    image?.candidates.some(candidate => candidate.source === INTERNAL_SOURCE) ?? false;

  const {
    data: debugFiles,
    isLoading,
    isError,
    refetch,
  } = useApiQuery<DebugFile[]>(
    [
      `/projects/${organization.slug}/${projSlug}/files/dsyms/?debug_id=${image?.debug_id}`,
      {
        query: {
          // FIXME(swatinem): Ideally we should not filter here at all,
          // though Symbolicator does not currently report `bcsymbolmap` and `il2cpp`
          // candidates, and we would thus show bogus "unapplied" entries for those,
          // which would probably confuse people more than not seeing successfully
          // fetched candidates for those two types of files.
          file_formats: [
            'breakpad',
            'macho',
            'elf',
            'pe',
            'pdb',
            'sourcebundle',
            'wasm',
            'portablepdb',
          ],
        },
      },
    ],
    {
      enabled: hasUploadedDebugFiles,
      staleTime: 0,
    }
  );

  const {code_file, status} = image ?? {};
  const candidates = getCandidates({debugFiles, image, isLoading});
  const baseUrl = api.baseUrl;
  const fileName = getFileName(code_file);
  const haveCandidatesUnappliedDebugFile = candidates.some(
    candidate => candidate.download.status === CandidateDownloadStatus.UNAPPLIED
  );
  const hasReprocessWarning =
    haveCandidatesUnappliedDebugFile &&
    displayReprocessEventAction(organization.features, event) &&
    !!onReprocessEvent;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  const handleDelete = async (debugId: string) => {
    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projSlug}/files/dsyms/?id=${debugId}`,
        {method: 'DELETE'}
      );
      refetch();
    } catch {
      addErrorMessage(t('An error occurred while deleting the debug file.'));
    }
  };

  const debugFilesSettingsLink =
    projSlug && image?.debug_id
      ? `/settings/${organization.slug}/projects/${projSlug}/debug-symbols/?query=${image?.debug_id}`
      : undefined;

  return (
    <Fragment>
      <Header closeButton>
        <Title>
          {t('Image')}
          <FileName>{fileName ?? t('Unknown')}</FileName>
        </Title>
      </Header>
      <Body>
        <Content>
          <GeneralInfo image={image} />
          {hasReprocessWarning && (
            <ReprocessAlert
              api={api}
              orgSlug={organization.slug}
              projSlug={projSlug}
              eventId={event.id}
              onReprocessEvent={onReprocessEvent}
            />
          )}
          <Candidates
            imageStatus={status}
            candidates={candidates}
            organization={organization}
            projSlug={projSlug}
            baseUrl={baseUrl}
            isLoading={isLoading}
            eventDateReceived={event.dateReceived}
            onDelete={handleDelete}
            hasReprocessWarning={hasReprocessWarning}
          />
        </Content>
      </Body>
      <Footer>
        <StyledButtonBar gap={1}>
          <Button
            href="https://docs.sentry.io/platforms/native/data-management/debug-files/"
            external
          >
            {t('Read the docs')}
          </Button>
          {debugFilesSettingsLink && (
            <LinkButton
              title={t(
                'Search for this debug file in all images for the %s project',
                projSlug
              )}
              to={debugFilesSettingsLink}
            >
              {t('Open in Settings')}
            </LinkButton>
          )}
        </StyledButtonBar>
      </Footer>
    </Fragment>
  );
}

const Content = styled('div')`
  display: grid;
  gap: ${space(3)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  max-width: calc(100% - 40px);
  word-break: break-all;
`;

const FileName = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;

const StyledButtonBar = styled(ButtonBar)`
  white-space: nowrap;
`;

export const modalCss = css`
  [role='document'] {
    overflow: initial;
  }

  @media (min-width: ${theme.breakpoints.small}) {
    width: 90%;
  }

  @media (min-width: ${theme.breakpoints.xlarge}) {
    width: 70%;
  }

  @media (min-width: ${theme.breakpoints.xxlarge}) {
    width: 50%;
  }
`;
