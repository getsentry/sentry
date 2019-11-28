import React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/button';
import space from 'app/styles/space';
import Confirm from 'app/components/confirm';

type Props = {
  url: string | null;
  onDelete: (url: string) => void;
};

class EventAttachmentActions extends React.Component<Props> {
  handleDelete = () => {
    const {url, onDelete} = this.props;

    if (url) {
      onDelete(url);
    }
  };

  render() {
    const {url} = this.props;

    return (
      <React.Fragment>
        <Button
          size="xsmall"
          icon="icon-download"
          href={url ? `${url}?download=1` : ''}
          disabled={!url}
          style={{
            marginRight: space(0.5),
          }}
          title={!url ? t('Insufficient permissions to download attachments') : undefined}
        >
          {t('Download')}
        </Button>

        <Confirm
          confirmText={t('Delete')}
          message={t('Are you sure you wish to delete this file?')}
          priority="danger"
          onConfirm={this.handleDelete}
          disabled={!url}
        >
          <Button
            size="xsmall"
            icon="icon-trash"
            disabled={!url}
            priority="danger"
            title={!url ? t('Insufficient permissions to delete attachments') : undefined}
          />
        </Confirm>
      </React.Fragment>
    );
  }
}

export default EventAttachmentActions;
