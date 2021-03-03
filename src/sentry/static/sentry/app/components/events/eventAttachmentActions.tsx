import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import {IconDelete, IconDownload, IconShow} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  url: string | null;
  attachmentId: string;
  withPreviewButton?: boolean;
  hasPreview?: boolean;
  previewIsOpen?: boolean;
  onDelete: (attachmentId: string) => void;
  onPreview?: (attachmentId: string) => void;
};

class EventAttachmentActions extends React.Component<Props> {
  handleDelete = async () => {
    const {api, url, onDelete, attachmentId} = this.props;

    if (url) {
      try {
        await api.requestPromise(url, {
          method: 'DELETE',
        });

        onDelete(attachmentId);
      } catch (_err) {
        // TODO: Error-handling
      }
    }
  };

  handlePreview() {
    const {onPreview, attachmentId} = this.props;
    if (onPreview) {
      onPreview(attachmentId);
    }
  }

  render() {
    const {url, withPreviewButton, hasPreview, previewIsOpen} = this.props;

    return (
      <ButtonBar gap={1}>
        <Confirm
          confirmText={t('Delete')}
          message={t('Are you sure you wish to delete this file?')}
          priority="danger"
          onConfirm={this.handleDelete}
          disabled={!url}
        >
          <Button
            size="xsmall"
            icon={<IconDelete size="xs" />}
            label={t('Delete')}
            disabled={!url}
            title={!url ? t('Insufficient permissions to delete attachments') : undefined}
          />
        </Confirm>

        <DownloadButton
          size="xsmall"
          icon={<IconDownload size="xs" />}
          href={url ? `${url}?download=1` : ''}
          disabled={!url}
          title={!url ? t('Insufficient permissions to download attachments') : undefined}
          label={t('Download')}
        />

        {withPreviewButton && (
          <DownloadButton
            size="xsmall"
            disabled={!url || !hasPreview}
            priority={previewIsOpen ? 'primary' : 'default'}
            icon={<IconShow size="xs" />}
            onClick={() => this.handlePreview()}
            title={
              !url
                ? t('Insufficient permissions to preview attachments')
                : !hasPreview
                ? t('This attachment cannot be previewed')
                : undefined
            }
          >
            {t('Preview')}
          </DownloadButton>
        )}
      </ButtonBar>
    );
  }
}

const DownloadButton = styled(Button)`
  margin-right: ${space(0.5)};
`;

export default withApi(EventAttachmentActions);
