import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DropdownLink from 'app/components/dropdownLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import {IconDownload, IconEllipsis} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {EventAttachment, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import withApi from 'app/utils/withApi';

import DataSection from './dataSection';
import ScreenshotEmpty from './screenshotEmpty';
import ScreenshotPreview from './screenshotPreview';

type Props = {
  event: Event;
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
};

function Screenshot({event, api, orgSlug, projectSlug}: Props) {
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      case 'text/plain':
        return attachment.size > 0;
      case 'text/json':
      case 'text/x-json':
      case 'application/json':
        return true;
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

    const {metadata} = event;
    const {stripped_crash: crashFileStripped} = metadata;

    const firstAttachmenteWithPreview = attachments.find(hasPreview);

    if (
      !firstAttachmenteWithPreview ||
      (!firstAttachmenteWithPreview && !crashFileStripped)
    ) {
      return <ScreenshotEmpty />;
    }

    return (
      <Fragment>
        <StyledPanelBody>
          <ScreenshotPreview
            attachment={firstAttachmenteWithPreview}
            orgSlug={orgSlug}
            projectSlug={projectSlug}
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
              >
                {t('Download')}
              </MenuItemActionLink>
            </DropdownLink>
          </StyledButtonbar>
        </StyledPanelFooter>
      </Fragment>
    );
  }

  return (
    <DataSection title={t('Screenshots')} description={t('This is a temp description')}>
      <StyledPanel>{renderContent()}</StyledPanel>
    </DataSection>
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
