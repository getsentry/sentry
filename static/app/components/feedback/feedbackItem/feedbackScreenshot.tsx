import {useState} from 'react';
import styled from '@emotion/styled';

import ImageVisualization from 'sentry/components/events/eventTagsAndScreenshot/screenshot/imageVisualization';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconImage} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventAttachment} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
  className?: string;
  onClick?: () => void;
};

export default function FeedbackScreenshot({
  className,
  organization,
  projectSlug,
  screenshot,
  onClick,
}: Props) {
  const [isLoading, setIsLoading] = useState(true);
  // since we can't trust mimetype, we'll try to load all attachments as images
  // if it fails, then set that here, and render a default preview instead.
  const [imgLoadError, setImgLoadError] = useState(false);

  const img = (
    <StyledImageVisualization
      attachment={screenshot}
      orgSlug={organization.slug}
      projectSlug={projectSlug}
      eventId={screenshot.event_id}
      onLoad={() => {
        setIsLoading(false);
      }}
      onError={() => {
        setIsLoading(false);
        setImgLoadError(true);
      }}
    />
  );

  return !imgLoadError ? (
    <StyledPanel className={className}>
      {isLoading && (
        <StyledLoadingIndicator>
          <LoadingIndicator mini />
        </StyledLoadingIndicator>
      )}
      {onClick ? <StyledImageButton onClick={onClick}>{img}</StyledImageButton> : img}
    </StyledPanel>
  ) : (
    <File onClick={onClick}>
      <NoPreviewFound>
        <IconImage />
        {t('No preview found')}
      </NoPreviewFound>
      <Tooltip position="right" title={t('Click to download')}>
        <FileDownload
          aria-label="feedback-attachment-download-button"
          href={`/api/0/projects/${organization.slug}/${projectSlug}/events/${screenshot.event_id}/attachments/${screenshot.id}/?download=1`}
        >
          <TextOverflow>{screenshot.name}</TextOverflow>
        </FileDownload>
      </Tooltip>
    </File>
  );
}

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 0;
  border: 0;
  border-radius: ${p => p.theme.borderRadius};
`;

const StyledLoadingIndicator = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: ${p => p.theme.purple100};
`;

const StyledImageButton = styled('button')`
  cursor: zoom-in;
  background: none;
  padding: 0;
  border: 0;
  overflow: auto;
`;

const StyledImageVisualization = styled(ImageVisualization)`
  z-index: 1;
  border: 0;
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  img {
    width: auto;
    height: auto;
  }
`;
const FileDownload = styled('a')`
  cursor: pointer;
  padding: ${space(1)};
  text-decoration: underline;
  color: inherit;
  :hover {
    color: inherit;
    text-decoration: underline;
  }
`;

const File = styled(StyledPanel)`
  background: ${p => p.theme.purple100};
  padding: ${space(2)};
  max-width: 300px;
`;

const NoPreviewFound = styled('p')`
  color: ${p => p.theme.gray300};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.5)};
  justify-content: center;
  margin: 0;
`;
