import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
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
import {EventAttachment, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';

import DataSection from '../dataSection';

import ImageVisualization from './imageVisualization';
import Modal, {modalCss} from './modal';

type Props = {
  event: Event;
  onDelete: (attachmentId: EventAttachment['id']) => void;
  organization: Organization;
  projectSlug: Project['slug'];
  screenshot: EventAttachment;
};

function Screenshot({event, organization, screenshot, projectSlug, onDelete}: Props) {
  const orgSlug = organization.slug;
  const [loadingImage, setLoadingImage] = useState(true);

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
        <StyledPanelBody
          onClick={() =>
            handleOpenVisualizationModal(
              screenshotAttachment,
              `${downloadUrl}?download=1`
            )
          }
        >
          <StyledImageVisualization
            attachment={screenshotAttachment}
            orgId={orgSlug}
            projectId={projectSlug}
            event={event}
            onLoad={() => setLoadingImage(false)}
            onError={() => setLoadingImage(false)}
          />
          {loadingImage && <StyledLoadingIndicator mini />}
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
                  'This image was captured around the time that the event occurred.'
                )}
                message={t('Are you sure you wish to delete this image?')}
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

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
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

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
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
