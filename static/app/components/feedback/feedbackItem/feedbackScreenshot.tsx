import type {ReactEventHandler} from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Role} from 'sentry/components/acl/role';
import {Button} from 'sentry/components/button';
import ImageVisualization from 'sentry/components/events/eventTagsAndScreenshot/screenshot/imageVisualization';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventAttachment, Organization, Project} from 'sentry/types';

type Props = {
  eventId: Event['id'];
  openVisualizationModal: (eventAttachment: EventAttachment) => void;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
  screenshotInFocus: number;
  totalScreenshots: number;
  onNext?: ReactEventHandler;
  onPrevious?: ReactEventHandler;
};

function FeedbackScreenshot({
  eventId,
  organization,
  screenshot,
  screenshotInFocus,
  onNext,
  onPrevious,
  totalScreenshots,
  projectSlug,
  openVisualizationModal,
}: Props) {
  const orgSlug = organization.slug;
  const [loadingImage, setLoadingImage] = useState(true);

  function renderContent(screenshotAttachment: EventAttachment) {
    return (
      <Fragment>
        {totalScreenshots > 1 && (
          <StyledPanelHeader lightText>
            <Button
              disabled={screenshotInFocus === 0}
              aria-label={t('Previous Screenshot')}
              onClick={onPrevious}
              icon={<IconChevron direction="left" />}
              size="xs"
            />
            {tct('[currentScreenshot] of [totalScreenshots]', {
              currentScreenshot: screenshotInFocus + 1,
              totalScreenshots,
            })}
            <Button
              disabled={screenshotInFocus + 1 === totalScreenshots}
              aria-label={t('Next Screenshot')}
              onClick={onNext}
              icon={<IconChevron direction="right" />}
              size="xs"
            />
          </StyledPanelHeader>
        )}
        <StyledPanelBody hasHeader={totalScreenshots > 1}>
          {loadingImage && (
            <StyledLoadingIndicator>
              <LoadingIndicator mini />
            </StyledLoadingIndicator>
          )}
          <StyledImageWrapper
            onClick={() => openVisualizationModal(screenshotAttachment)}
          >
            <StyledImageVisualization
              attachment={screenshotAttachment}
              orgId={orgSlug}
              projectSlug={projectSlug}
              eventId={eventId}
              onLoad={() => setLoadingImage(false)}
              onError={() => setLoadingImage(false)}
            />
          </StyledImageWrapper>
        </StyledPanelBody>
      </Fragment>
    );
  }

  return (
    <Role organization={organization} role={organization.attachmentsRole}>
      {({hasRole}) => {
        if (!hasRole) {
          return null;
        }
        return <StyledPanel>{renderContent(screenshot)}</StyledPanel>;
      }}
    </Role>
  );
}

export default FeedbackScreenshot;

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 0;
  max-width: 360px;
  max-height: 360px;
  border: 0;
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding: ${space(1)};
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-bottom: 0;
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
  display: flex;
  justify-content: space-between;
  text-transform: none;
  background: ${p => p.theme.background};
`;

const StyledPanelBody = styled(PanelBody)<{hasHeader: boolean}>`
  border: 1px solid ${p => p.theme.border};
  min-height: 48px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;

  ${p =>
    !p.hasHeader &&
    `
  border-top-left-radius: ${p.theme.borderRadius};
  border-top-right-radius: ${p.theme.borderRadius};
  `}
`;

const StyledLoadingIndicator = styled('div')`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const StyledImageWrapper = styled('button')`
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
