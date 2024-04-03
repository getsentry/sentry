import {useState} from 'react';
import styled from '@emotion/styled';

import {Role} from 'sentry/components/acl/role';
import ImageVisualization from 'sentry/components/events/eventTagsAndScreenshot/screenshot/imageVisualization';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import type {EventAttachment, Organization, Project} from 'sentry/types';

type Props = {
  onClick: () => void;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
};

export default function FeedbackScreenshot({
  organization,
  screenshot,
  projectSlug,
  onClick,
}: Props) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Role organization={organization} role={organization.attachmentsRole}>
      {({hasRole}) => {
        if (!hasRole) {
          return null;
        }
        return (
          <StyledPanel>
            {isLoading && (
              <StyledLoadingIndicator>
                <LoadingIndicator mini />
              </StyledLoadingIndicator>
            )}
            <StyledImageButton onClick={onClick}>
              <StyledImageVisualization
                attachment={screenshot}
                orgId={organization.slug}
                projectSlug={projectSlug}
                eventId={screenshot.event_id}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            </StyledImageButton>
          </StyledPanel>
        );
      }}
    </Role>
  );
}

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 0;
  max-width: 360px;
  max-height: 360px;
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
  border-radius: ${p => p.theme.borderRadius};
  border: 0;
  overflow: hidden;
`;

const StyledImageVisualization = styled(ImageVisualization)`
  z-index: 1;
  border: 0;
  img {
    width: auto;
    height: auto;
  }
`;
