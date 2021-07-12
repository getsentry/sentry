import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import Role from 'app/components/acl/role';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownLink from 'app/components/dropdownLink';
import ImageViewer from 'app/components/events/attachmentViewers/imageViewer';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import {IconDownload, IconEllipsis} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {EventAttachment, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import withApi from 'app/utils/withApi';

import DataSection from '../dataSection';

import EmptyState from './emptyState';
import {platformsMobileWithAttachmentsFeature} from './utils';

type Props = {
  event: Event;
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
};

function Screenshot({event, api, organization, projectSlug}: Props) {
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const orgSlug = organization.slug;
  const eventPlatform = event.platform;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    if (!event) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/events/${event.id}/attachments/`
      );
      setAttachments(response);
      setIsLoading(false);
    } catch (_err) {
      // TODO: Error-handling
      setAttachments([]);
      setIsLoading(false);
    }
  }

  function hasPreview(attachment: EventAttachment) {
    switch (attachment.mimetype) {
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
        return true;
      default:
        return false;
    }
  }

  function renderContent() {
    if (isLoading) {
      return <LoadingIndicator mini />;
    }

    const firstAttachmenteWithPreview = attachments.find(hasPreview);

    if (!firstAttachmenteWithPreview) {
      return <EmptyState platform={eventPlatform} />;
    }

    const downloadUrl = `/api/0/projects/${organization.slug}/${projectSlug}/events/${event.id}/attachments/${firstAttachmenteWithPreview.id}/`;

    return (
      <Fragment>
        <StyledPanelBody>
          <StyledImageViewer
            attachment={firstAttachmenteWithPreview}
            orgId={orgSlug}
            projectId={projectSlug}
            event={event}
          />
        </StyledPanelBody>
        <StyledPanelFooter>
          <StyledButtonbar gap={1}>
            <Button size="xsmall">{t('View screenshot')}</Button>
            <DropdownLink
              caret={false}
              customTitle={
                <Button
                  label={t('Actions')}
                  size="xsmall"
                  icon={<IconEllipsis size="xs" />}
                />
              }
              anchorRight
            >
              <MenuItemActionLink
                shouldConfirm={false}
                icon={<IconDownload size="xs" />}
                title={t('Download')}
                href={`${downloadUrl}?download=1`}
              >
                {t('Download')}
              </MenuItemActionLink>
            </DropdownLink>
          </StyledButtonbar>
        </StyledPanelFooter>
      </Fragment>
    );
  }

  // the UI should only render the screenshots feature in events with platforms that support screenshots
  if (
    !eventPlatform ||
    !platformsMobileWithAttachmentsFeature.includes(eventPlatform as any)
  ) {
    return null;
  }

  return (
    <Role role={organization.attachmentsRole}>
      {({hasRole}) => {
        if (!hasRole) {
          // if the user has no access to the attachments,
          // the UI shall not display the screenshot section
          return null;
        }
        return (
          <DataSection
            title={t('Screenshots')}
            description={t(
              'Screenshots help identify what the user saw when the exception happened'
            )}
          >
            <StyledPanel>{renderContent()}</StyledPanel>
          </DataSection>
        );
      }}
    </Role>
  );
}

export default withApi(Screenshot);

const StyledPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-bottom: 0;
  min-width: 175px;
  min-height: 200px;
`;

const StyledPanelBody = styled(PanelBody)`
  height: 175px;
  width: 100%;
  overflow: hidden;
`;

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)};
  width: 100%;
`;

const StyledButtonbar = styled(ButtonBar)`
  justify-content: space-between;
  .dropdown {
    height: 24px;
  }
`;

const StyledImageViewer = styled(ImageViewer)`
  padding: 0;
  height: 100%;
  img {
    width: auto;
    height: 100%;
    object-fit: cover;
    flex: 1;
  }
`;
