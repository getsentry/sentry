import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Role} from 'sentry/components/acl/role';
import MenuItemActionLink from 'sentry/components/actions/menuItemActionLink';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownLink from 'sentry/components/dropdownLink';
import {Panel, PanelBody, PanelFooter} from 'sentry/components/panels';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EventAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';

import DataSection from '../dataSection';

import ImageVisualization from './imageVisualization';
import Modal, {modalCss} from './modal';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
  onDelete: (attachmentId: EventAttachment['id']) => void;
};

function Screenshot({event, organization, screenshot, projectSlug, onDelete}: Props) {
  const orgSlug = organization.slug;

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
          onDelete={() => onDelete(eventAttachment.id)}
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
          <StyledImageVisualization
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
                  aria-label={t('Actions')}
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
                onAction={() => onDelete(screenshotAttachment.id)}
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
    <Role organization={organization} role={organization.attachmentsRole}>
      {({hasRole}) => {
        if (!hasRole) {
          return null;
        }

        return (
          <DataSection
            title={t('Screenshot')}
            description={t(
              'Screenshot help identify what the user saw when the event happened'
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
  min-height: 200px;
  min-width: 175px;
  height: 100%;
`;

const StyledPanelBody = styled(PanelBody)`
  min-height: 175px;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin: -1px;
  width: calc(100% + 2px);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  position: relative;
`;

const StyledPanelFooter = styled(PanelFooter)`
  padding: ${space(1)};
  width: 100%;
`;

const StyledImageVisualization = styled(ImageVisualization)`
  position: absolute;
  width: 100%;
`;

const StyledButtonbar = styled(ButtonBar)`
  justify-content: space-between;
  .dropdown {
    height: 24px;
  }
`;
