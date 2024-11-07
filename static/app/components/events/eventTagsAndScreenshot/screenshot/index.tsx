import type {ReactEventHandler} from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {useRole} from 'sentry/components/acl/useRole';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconChevron, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {EventAttachment} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';

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
  const {hasRole} = useRole({role: 'attachmentsRole'});

  function handleDelete(screenshotAttachmentId: string) {
    trackAnalytics('issue_details.issue_tab.screenshot_dropdown_deleted', {
      organization,
    });
    onDelete(screenshotAttachmentId);
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
            onClick={() =>
              openVisualizationModal(screenshotAttachment, `${downloadUrl}?download=1`)
            }
          >
            <StyledImageVisualization
              attachment={screenshotAttachment}
              orgSlug={orgSlug}
              projectSlug={projectSlug}
              eventId={eventId}
              onLoad={() => setLoadingImage(false)}
              onError={() => setLoadingImage(false)}
            />
          </StyledImageWrapper>
        </StyledPanelBody>
        {!onlyRenderScreenshot && (
          <StyledPanelFooter>
            <ButtonBar gap={1}>
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
              <DropdownMenu
                position="bottom"
                offset={4}
                triggerProps={{
                  showChevron: false,
                  icon: <IconEllipsis />,
                  'aria-label': t('More screenshot actions'),
                }}
                size="xs"
                items={[
                  {
                    key: 'download',
                    label: t('Download'),
                    onAction: () => {
                      window.location.assign(`${downloadUrl}?download=1`);
                      trackAnalytics(
                        'issue_details.issue_tab.screenshot_dropdown_download',
                        {organization}
                      );
                    },
                  },
                  {
                    key: 'delete',
                    label: t('Delete'),
                    onAction: () =>
                      openConfirmModal({
                        header: t('Delete this image?'),
                        message: t(
                          'This image was captured around the time that the event occurred. Are you sure you want to delete this image?'
                        ),
                        onConfirm: () => handleDelete(screenshotAttachment.id),
                      }),
                  },
                ]}
              />
            </ButtonBar>
          </StyledPanelFooter>
        )}
      </Fragment>
    );
  }

  if (!hasRole) {
    return null;
  }

  return <StyledPanel>{renderContent(screenshot)}</StyledPanel>;
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
