import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Role} from 'sentry/components/acl/role';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownLink from 'sentry/components/dropdownLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelFooter} from 'sentry/components/panels';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, EventAttachment, Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import DataSection from '../dataSection';

import ImageVisualization from './imageVisualization';

type Props = {
  eventId: Event['id'];
  onDelete: (attachmentId: EventAttachment['id']) => void;
  openVisualizationModal: (eventAttachment: EventAttachment, downloadUrl: string) => void;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
  onlyRenderScreenshot?: boolean;
};

function Screenshot({
  eventId,
  organization,
  screenshot,
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
        <StyledPanelBody
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
          {loadingImage && (
            <StyledLoadingIndicator>
              <LoadingIndicator mini />
            </StyledLoadingIndicator>
          )}
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

        if (onlyRenderScreenshot) {
          return <StyledPanel>{renderContent(screenshot)}</StyledPanel>;
        }

        return (
          <DataSection
            title={t('Screenshot')}
            description={t(
              'This image was captured around the time that the event occurred.'
            )}
          >
            <StyledPanel>{renderContent(screenshot)}</StyledPanel>
          </DataSection>
        );
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

const StyledPanelBody = styled(PanelBody)`
  border: 1px solid ${p => p.theme.border};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
  width: 100%;
  min-height: 48px;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
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
