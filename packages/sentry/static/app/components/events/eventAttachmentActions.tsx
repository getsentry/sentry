import {Component} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {IconDelete, IconDownload, IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  attachmentId: string;
  onDelete: (attachmentId: string) => void;
  url: string | null;
  hasPreview?: boolean;
  onPreview?: (attachmentId: string) => void;
  previewIsOpen?: boolean;
  withPreviewButton?: boolean;
};

class EventAttachmentActions extends Component<Props> {
  handlePreview() {
    const {onPreview, attachmentId} = this.props;
    if (onPreview) {
      onPreview(attachmentId);
    }
  }

  render() {
    const {url, withPreviewButton, hasPreview, previewIsOpen, onDelete, attachmentId} =
      this.props;

    return (
      <ButtonBar gap={1}>
        <Confirm
          confirmText={t('Delete')}
          message={t('Are you sure you wish to delete this file?')}
          priority="danger"
          onConfirm={() => onDelete(attachmentId)}
          disabled={!url}
        >
          <Button
            size="xs"
            icon={<IconDelete size="xs" />}
            aria-label={t('Delete')}
            disabled={!url}
            title={!url ? t('Insufficient permissions to delete attachments') : undefined}
          />
        </Confirm>

        <DownloadButton
          size="xs"
          icon={<IconDownload size="xs" />}
          href={url ? `${url}?download=1` : ''}
          disabled={!url}
          title={!url ? t('Insufficient permissions to download attachments') : undefined}
          aria-label={t('Download')}
        />

        {withPreviewButton && (
          <DownloadButton
            size="xs"
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
