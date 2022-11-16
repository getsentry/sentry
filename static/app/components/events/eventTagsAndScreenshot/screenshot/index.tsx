import {Fragment, ReactEventHandler, useState} from 'react';
import styled from '@emotion/styled';

import {Role} from 'sentry/components/acl/role';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownLink from 'sentry/components/dropdownLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelFooter, PanelHeader} from 'sentry/components/panels';
import {IconChevron, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, EventAttachment, Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import ImageVisualization from './imageVisualization';

type Props = {
  eventId: Event['id'];
  onDelete: (attachmentId: EventAttachment['id']) => void;
  openVisualizationModal: (eventAttachment: EventAttachment, downloadUrl: string) => void;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
  screenshotInFocus: number;
  totalScreenshots: number;
  onNext?: ReactEventHandler;
  onPrevious?: ReactEventHandler;
  onlyRenderScreenshot?: boolean;
};

function Screenshot({
  eventId,
  organization,
  screenshot,
  screenshotInFocus,
  onNext,
  onPrevious,
  totalScreenshots,
  projectSlug,
  onlyRenderScreenshot,
  onDelete,
  openVisualizationModal,
}: Props) {
  const orgSlug = organization.slug;
  const [loadingImage, setLoadingImage] = useState(true);

  function handleDelete(screenshotAttachment) {
    trackAdvancedAnalyticsEvent('issue_details.issue_tab.screenshot_dropdown_deleted', {
      organization,
    });
    onDelete(screenshotAttachment.id);
  }

  function renderContent(screenshotAttachment: EventAttachment) {
    const downloadUrl = `/api/0/projects/${organization.slug}/${projectSlug}/events/${eventId}/attachments/${screenshotAttachment.id}/`;

    return (
      <Fragment>
        {totalScreenshots > 1 && (
          <StyledPanelHeader lightText>
            <Button
              disabled={screenshotInFocus === 0}
              aria-label={t('Previous Screenshot')}
              onClick={onPrevious}
              icon={<IconChevron direction="left" size="xs" />}
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
              icon={<IconChevron direction="right" size="xs" />}
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
            onClick={() =>
              openVisualizationModal(screenshotAttachment, `${downloadUrl}?download=1`)
            }
          >
            <StyledImageVisualization
              attachment={screenshotAttachment}
              orgId={orgSlug}
              projectId={projectSlug}
              eventId={eventId}
              onLoad={() => setLoadingImage(false)}
              onError={() => setLoadingImage(false)}
            />
          </StyledImageWrapper>
        </StyledPanelBody>
        {!onlyRenderScreenshot && (
          <StyledPanelFooter>
            <StyledButtonbar gap={1}>
              <Button
                size="xs"
                onClick={() =>
                  openVisualizationModal(
                    screenshotAttachment,
                    `${downloadUrl}?download=1`
                  )
                }
              >
                {t('View screenshot')}
              </Button>
              <DropdownLink
                caret={false}
                customTitle={
                  <Button
                    aria-label={t('Actions')}
                    size="xs"
                    icon={<IconEllipsis size="xs" />}
                  />
                }
                anchorRight
              >
                <MenuItemActionLink
                  shouldConfirm={false}
                  onAction={() =>
                    trackAdvancedAnalyticsEvent(
                      'issue_details.issue_tab.screenshot_dropdown_download',
                      {
                        organization,
                      }
                    )
                  }
                  href={`${downloadUrl}?download=1`}
                >
                  {t('Download')}
                </MenuItemActionLink>
                <MenuItemActionLink
                  shouldConfirm
                  onAction={() => handleDelete(screenshotAttachment.id)}
                  header={t(
                    'This image was captured around the time that the event occurred.'
                  )}
                  message={t('Are you sure you wish to delete this image?')}
                >
                  {t('Delete')}
                </MenuItemActionLink>
              </DropdownLink>
            </StyledButtonbar>
          </StyledPanelFooter>
        )}
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

export default Screenshot;

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 0;
  max-width: 100%;
  height: 100%;
  border: 0;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 175px;
  }
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
  width: 100%;
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

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)};
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-top: 0;
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
`;

const StyledLoadingIndicator = styled('div')`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const StyledImageWrapper = styled('div')`
  :hover {
    cursor: pointer;
  }
`;

const StyledImageVisualization = styled(ImageVisualization)`
  width: 100%;
  z-index: 1;
  border: 0;
`;

const StyledButtonbar = styled(ButtonBar)`
  justify-content: space-between;
  .dropdown {
    height: 24px;
  }
`;
