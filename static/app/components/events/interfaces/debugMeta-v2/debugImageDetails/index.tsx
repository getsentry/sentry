import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import AlertLink from 'app/components/alertLink';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource, DebugFile, DebugFileFeature} from 'app/types/debugFiles';
import {CandidateDownloadStatus, Image, ImageStatus} from 'app/types/debugImage';
import {Event} from 'app/types/event';
import {displayReprocessEventAction} from 'app/utils/displayReprocessEventAction';
import theme from 'app/utils/theme';
import {getFileType} from 'app/views/settings/projectDebugFiles/utils';

import {getFileName} from '../utils';

import Candidates from './candidates';
import GeneralInfo from './generalInfo';
import {INTERNAL_SOURCE, INTERNAL_SOURCE_LOCATION} from './utils';

type ImageCandidates = Image['candidates'];

type Props = AsyncComponent['props'] &
  ModalRenderProps & {
    projectId: Project['id'];
    organization: Organization;
    event: Event;
    image?: Image & {status: ImageStatus};
    onReprocessEvent?: () => void;
  };

type State = AsyncComponent['state'] & {
  debugFiles: Array<DebugFile> | null;
  builtinSymbolSources: Array<BuiltinSymbolSource> | null;
};

class DebugImageDetails extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      debugFiles: [],
      builtinSymbolSources: [],
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!prevProps.image && !!this.props.image) {
      this.remountComponent();
    }

    super.componentDidUpdate(prevProps, prevState);
  }

  getUplodedDebugFiles(candidates: ImageCandidates) {
    return candidates.find(candidate => candidate.source === INTERNAL_SOURCE);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, projectId, image} = this.props;

    if (!image) {
      return [];
    }

    const {debug_id, candidates = []} = image;
    const {builtinSymbolSources} = this.state || {};

    const uploadedDebugFiles = this.getUplodedDebugFiles(candidates);
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [];

    if (uploadedDebugFiles) {
      endpoints.push([
        'debugFiles',
        `/projects/${organization.slug}/${projectId}/files/dsyms/?debug_id=${debug_id}`,
        {
          query: {
            file_formats: ['breakpad', 'macho', 'elf', 'pe', 'pdb', 'sourcebundle'],
          },
        },
      ]);
    }

    if (
      !builtinSymbolSources?.length &&
      organization.features.includes('symbol-sources')
    ) {
      endpoints.push(['builtinSymbolSources', '/builtin-symbol-sources/', {}]);
    }

    return endpoints;
  }

  sortCandidates(
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

  getCandidates() {
    const {debugFiles, loading} = this.state;
    const {image} = this.props;
    const {candidates = []} = image ?? {};

    if (!debugFiles || loading) {
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
        fileType: getFileType(debugFile),
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
          cpuName,
        } = internalDebugFileInfo;

        return {
          ...debugFileOkCandidate,
          cpuName,
          location,
          filename,
          size,
          dateCreated,
          symbolType,
          fileType: getFileType(internalDebugFileInfo),
        };
      }
    );

    return this.sortCandidates(
      [
        ...convertedDebugFileInternalOkCandidates,
        ...debugFileOtherCandidates,
      ] as ImageCandidates,
      unAppliedCandidates as ImageCandidates
    );
  }

  handleDelete = async (debugId: string) => {
    const {organization, projectId} = this.props;

    this.setState({loading: true});

    try {
      await this.api.requestPromise(
        `/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugId}`,
        {method: 'DELETE'}
      );
      this.fetchData();
    } catch {
      addErrorMessage(t('An error occurred while deleting the debug file.'));
      this.setState({loading: false});
    }
  };

  getDebugFilesSettingsLink() {
    const {organization, projectId, image} = this.props;
    const orgSlug = organization.slug;
    const debugId = image?.debug_id;

    if (!orgSlug || !projectId || !debugId) {
      return undefined;
    }

    return `/settings/${orgSlug}/projects/${projectId}/debug-symbols/?query=${debugId}`;
  }

  renderBody() {
    const {
      Header,
      Body,
      Footer,
      image,
      organization,
      projectId,
      onReprocessEvent,
      event,
    } = this.props;
    const {loading, builtinSymbolSources} = this.state;

    const {code_file, status} = image ?? {};
    const debugFilesSettingsLink = this.getDebugFilesSettingsLink();
    const candidates = this.getCandidates();
    const baseUrl = this.api.baseUrl;
    const fileName = getFileName(code_file);
    const haveCandidatesUnappliedDebugFile = candidates.some(
      candidate => candidate.download.status === CandidateDownloadStatus.UNAPPLIED
    );
    const hasReprocessWarning =
      haveCandidatesUnappliedDebugFile &&
      displayReprocessEventAction(organization.features, event) &&
      !!onReprocessEvent;

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
              <AlertLink
                priority="warning"
                size="small"
                onClick={onReprocessEvent}
                withoutMarginBottom
              >
                {t(
                  'You’ve uploaded new debug files. Reprocess events in this issue to view a better stack trace'
                )}
              </AlertLink>
            )}
            <Candidates
              imageStatus={status}
              candidates={candidates}
              organization={organization}
              projectId={projectId}
              baseUrl={baseUrl}
              isLoading={loading}
              eventDateReceived={event.dateReceived}
              builtinSymbolSources={builtinSymbolSources}
              onDelete={this.handleDelete}
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
              <Button
                title={t(
                  'Search for this debug file in all images for the %s project',
                  projectId
                )}
                to={debugFilesSettingsLink}
              >
                {t('Open in Settings')}
              </Button>
            )}
          </StyledButtonBar>
        </Footer>
      </Fragment>
    );
  }
}

export default DebugImageDetails;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(3)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Title = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
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

  @media (min-width: ${theme.breakpoints[0]}) {
    width: 90%;
  }

  @media (min-width: ${theme.breakpoints[3]}) {
    width: 70%;
  }

  @media (min-width: ${theme.breakpoints[4]}) {
    width: 50%;
  }
`;
