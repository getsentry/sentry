import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Role from 'app/components/acl/role';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownLink from 'app/components/dropdownLink';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import {IconEllipsis} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {EventAttachment, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import withApi from 'app/utils/withApi';

import DataSection from '../dataSection';

import ImageVisualization from './imageVisualization';
import Modal, {modalCss} from './modal';

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

  function hasScreenshot(attachment: EventAttachment) {
    const {mimetype} = attachment;
    return mimetype === 'image/jpeg' || mimetype === 'image/png';
  }

  async function handleDelete(screenshotAttachmentId: string, downloadUrl: string) {
    try {
      await api.requestPromise(downloadUrl.split('/api/0')[1], {
        method: 'DELETE',
      });

      setAttachments(
        attachments.filter(attachment => attachment.id !== screenshotAttachmentId)
      );
    } catch (_err) {
      // TODO: Error-handling
    }
  }

  function handleOpenVisualizationModal(
    eventAttachment: EventAttachment,
    downloadUrl: string
  ) {
    openModal(
      modalProps => (
        <Modal
          {...modalProps}
          event={event}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          eventAttachment={eventAttachment}
          downloadUrl={downloadUrl}
          onDelete={() => handleDelete(eventAttachment.id, downloadUrl)}
        />
      ),
      {modalCss}
    );
  }

  function renderContent(screenshotAttachment: EventAttachment) {
    const downloadUrl = `/api/0/projects/${organization.slug}/${projectSlug}/events/${event.id}/attachments/${screenshotAttachment.id}/`;

    return (
      <Fragment>
        <StyledPanelBody>
          <ImageVisualization
            attachment={screenshotAttachment}
            orgId={orgSlug}
            projectId={projectSlug}
            event={event}
          />
        </StyledPanelBody>
        <StyledPanelFooter>
          <StyledButtonbar gap={1}>
            <Button
              size="xsmall"
              onClick={() =>
                handleOpenVisualizationModal(
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
                  label={t('Actions')}
                  size="xsmall"
                  icon={<IconEllipsis size="xs" />}
                />
              }
              anchorRight
            >
              <MenuItemActionLink
                shouldConfirm={false}
                title={t('Download')}
                href={`${downloadUrl}?download=1`}
              >
                {t('Download')}
              </MenuItemActionLink>
              <MenuItemActionLink
                shouldConfirm
                title={t('Delete')}
                onAction={() => handleDelete(screenshotAttachment.id, downloadUrl)}
                header={t(
                  'Screenshots help identify what the user saw when the event happened'
                )}
                message={t('Are you sure you wish to delete this screenshot?')}
              >
                {t('Delete')}
              </MenuItemActionLink>
            </DropdownLink>
          </StyledButtonbar>
        </StyledPanelFooter>
      </Fragment>
    );
  }

  return (
    <Role role={organization.attachmentsRole}>
      {({hasRole}) => {
        const screenshotAttachment = attachments.find(hasScreenshot);

        if (!hasRole || isLoading || !screenshotAttachment) {
          return null;
        }

        return (
          <DataSection
            title={t('Screenshots')}
            description={t(
              'Screenshots help identify what the user saw when the event happened'
            )}
          >
            <StyledPanel>{renderContent(screenshotAttachment)}</StyledPanel>
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
  min-height: 200px;
  min-width: 175px;
`;

const StyledPanelBody = styled(PanelBody)`
  height: 175px;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin: -1px;
  width: calc(100% + 2px);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
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
