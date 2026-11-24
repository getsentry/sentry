import {resolveHostname} from 'sentry/utils/api/resolveHostname';

import type {ViewerProps} from './utils';
import {getAttachmentUrl} from './utils';

type Props = Omit<ViewerProps, 'attachment'> & {
  attachment: ViewerProps['attachment'];
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
};

export function ImageViewer({onLoad, onError, className, ...props}: Props) {
  return (
    <img
      className={className}
      data-test-id="image-viewer"
      src={resolveHostname(`/api/0${getAttachmentUrl(props)}?download`)}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
