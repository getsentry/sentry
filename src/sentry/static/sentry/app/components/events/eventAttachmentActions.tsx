import { Component, Fragment } from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Button from 'app/components/button';
import space from 'app/styles/space';
import Confirm from 'app/components/confirm';
import {IconDelete, IconDownload} from 'app/icons';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';

type Props = {
  api: Client;
  url: string | null;
  attachmentId: string;
  onDelete: (attachmentId: string) => void;
};

class EventAttachmentActions extends Component<Props> {
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

  render() {
    const {url} = this.props;

    return (
      <Fragment>
        <DownloadButton
          size="xsmall"
          icon={<IconDownload size="xs" />}
          href={url ? `${url}?download=1` : ''}
          disabled={!url}
          title={!url ? t('Insufficient permissions to download attachments') : undefined}
        >
          {t('Download')}
        </DownloadButton>

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
            disabled={!url}
            priority="danger"
            title={!url ? t('Insufficient permissions to delete attachments') : undefined}
          />
        </Confirm>
      </Fragment>
    );
  }
}

const DownloadButton = styled(Button)`
  margin-right: ${space(0.5)};
`;

export default withApi(EventAttachmentActions);
