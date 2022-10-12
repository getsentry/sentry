import {useState} from 'react';
import LazyLoad from 'react-lazyload';
import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import DateTime from 'sentry/components/dateTime';
import ImageVisualization from 'sentry/components/events/eventTagsAndScreenshot/screenshot/imageVisualization';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {IssueAttachment, Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  eventAttachment: IssueAttachment;
  eventId: string;
  projectSlug: Project['slug'];
};

export function ScreenshotCard({eventAttachment, projectSlug, eventId}: Props) {
  const organization = useOrganization();
  const [loadingImage, setLoadingImage] = useState(true);
  return (
    <Card interactive>
      <CardHeader>
        <CardContent>
          <Title>{eventId}</Title>
          <Detail>
            <DateTime date={eventAttachment.dateCreated} />
          </Detail>
        </CardContent>
      </CardHeader>
      <CardBody>
        <StyledPanelBody>
          <LazyLoad>
            <StyledImageVisualization
              attachment={eventAttachment}
              orgId={organization.slug}
              projectId={projectSlug}
              eventId={eventId}
              onLoad={() => setLoadingImage(false)}
              onError={() => setLoadingImage(false)}
            />
            {loadingImage && (
              <StyledLoadingIndicator>
                <LoadingIndicator mini />
              </StyledLoadingIndicator>
            )}
          </LazyLoad>
        </StyledPanelBody>
      </CardBody>
      <CardFooter>{t('screenshot.png')}</CardFooter>
    </Card>
  );
}

const Title = styled('div')`
  ${p => p.theme.overflowEllipsis};
  font-weight: normal;
`;

const Detail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  ${p => p.theme.overflowEllipsis};
  line-height: 1.5;
`;

const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const CardBody = styled('div')`
  background: ${p => p.theme.gray100};
  padding: ${space(1.5)} ${space(2)};
  max-height: 250px;
  min-height: 250px;
  overflow: hidden;
  border-bottom: 1px solid ${p => p.theme.gray100};
`;

const CardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const CardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const StyledPanelBody = styled(PanelBody)`
  height: 100%;
  min-height: 48px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const StyledLoadingIndicator = styled('div')`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const StyledImageVisualization = styled(ImageVisualization)`
  height: 100%;
  z-index: 1;
  border: 0;
`;
