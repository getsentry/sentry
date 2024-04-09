import {useState} from 'react';
import styled from '@emotion/styled';

import ImageVisualization from 'sentry/components/events/eventTagsAndScreenshot/screenshot/imageVisualization';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import type {EventAttachment, Organization, Project} from 'sentry/types';

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
  const img = (
    <StyledImageVisualization
      attachment={screenshot}
      orgId={organization.slug}
      projectSlug={projectSlug}
      eventId={screenshot.event_id}
      onLoad={() => setIsLoading(false)}
      onError={() => setIsLoading(false)}
    />
  );

  return (
    <StyledPanel className={className}>
      {isLoading && (
        <StyledLoadingIndicator>
          <LoadingIndicator mini />
        </StyledLoadingIndicator>
      )}
      {onClick ? <StyledImageButton onClick={onClick}>{img}</StyledImageButton> : img}
    </StyledPanel>
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
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
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
