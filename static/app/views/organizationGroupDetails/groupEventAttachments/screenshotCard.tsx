import {useState} from 'react';
import LazyLoad from 'react-lazyload';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';
import Card from 'sentry/components/card';
import DateTime from 'sentry/components/dateTime';
import DropdownLink from 'sentry/components/dropdownLink';
import ImageVisualization from 'sentry/components/events/eventTagsAndScreenshot/screenshot/imageVisualization';
import Modal, {
  modalCss,
} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/modal';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelBody} from 'sentry/components/panels';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {IssueAttachment, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  attachmentIndex: number;
  attachments: IssueAttachment[];
  eventAttachment: IssueAttachment;
  eventId: string;
  groupId: string;
  onDelete: (attachmentId: string) => void;
  projectSlug: Project['slug'];
  pageLinks?: string | null | undefined;
};

export function ScreenshotCard({
  eventAttachment,
  projectSlug,
  eventId,
  groupId,
  onDelete,
  pageLinks,
  attachmentIndex,
  attachments,
}: Props) {
  const organization = useOrganization();
  const [loadingImage, setLoadingImage] = useState(true);

  const downloadUrl = `/api/0/projects/${organization.slug}/${projectSlug}/events/${eventId}/attachments/${eventAttachment.id}/?download=1`;

  function handleDelete() {
    trackAdvancedAnalyticsEvent('issue_details.attachment_tab.screenshot_modal_deleted', {
      organization,
    });
    onDelete(eventAttachment.id);
  }

  function openVisualizationModal() {
    trackAdvancedAnalyticsEvent('issue_details.attachment_tab.screenshot_modal_opened', {
      organization,
    });
    openModal(
      modalProps => (
        <Modal
          {...modalProps}
          orgSlug={organization.slug}
          projectSlug={projectSlug}
          eventAttachment={eventAttachment}
          downloadUrl={downloadUrl}
          onDelete={handleDelete}
          pageLinks={pageLinks}
          attachments={attachments}
          attachmentIndex={attachmentIndex}
          groupId={groupId}
          enablePagination
          onDownload={() =>
            trackAdvancedAnalyticsEvent(
              'issue_details.attachment_tab.screenshot_modal_download',
              {
                organization,
              }
            )
          }
        />
      ),
      {modalCss}
    );
  }

  const baseEventsPath = `/organizations/${organization.slug}/issues/${groupId}/events/`;
  return (
    <Card>
      <CardHeader>
        <CardContent>
          <Title
            onClick={() =>
              trackAdvancedAnalyticsEvent(
                'issue_details.attachment_tab.screenshot_title_clicked',
                {
                  organization,
                }
              )
            }
            to={`${baseEventsPath}${eventId}/`}
          >
            {eventId}
          </Title>
          <Detail>
            <DateTime date={eventAttachment.dateCreated} />
          </Detail>
        </CardContent>
      </CardHeader>
      <CardBody>
        <StyledPanelBody
          onClick={() => openVisualizationModal()}
          data-test-id={`screenshot-${eventAttachment.id}`}
        >
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
      <CardFooter>
        <div>{eventAttachment.name}</div>
        <DropdownLink
          caret={false}
          customTitle={
            <Button
              aria-label={t('Actions')}
              size="xs"
              icon={<IconEllipsis direction="down" size="sm" />}
              borderless
            />
          }
          anchorRight
        >
          <MenuItemActionLink shouldConfirm={false} href={`${downloadUrl}`}>
            {t('Download')}
          </MenuItemActionLink>
          <MenuItemActionLink
            shouldConfirm
            confirmPriority="danger"
            confirmLabel={t('Delete')}
            onAction={() => onDelete(eventAttachment.id)}
            header={t('This image was captured around the time that the event occurred.')}
            message={t('Are you sure you wish to delete this image?')}
          >
            {t('Delete')}
          </MenuItemActionLink>
        </DropdownLink>
      </CardFooter>
    </Card>
  );
}

const Title = styled(Link)`
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
  .dropdown {
    height: 24px;
  }
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
