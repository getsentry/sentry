import type {ViewerProps} from 'sentry/components/events/attachmentViewers/utils';
import {getAttachmentUrl} from 'sentry/components/events/attachmentViewers/utils';

type Props = Omit<ViewerProps, 'attachment'> & {
  attachment: ViewerProps['attachment'];
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
};

function ImageViewer({onLoad, onError, className, ...props}: Props) {
  return (
    <img
      className={className}
      data-test-id="image-viewer"
      src={getAttachmentUrl(props, true)}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

export default ImageViewer;
