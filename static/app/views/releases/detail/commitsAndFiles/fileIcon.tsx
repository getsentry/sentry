import {PlatformIcon} from 'platformicons';

import {IconFile} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {fileExtensionToPlatform, getFileExtension} from 'sentry/utils/fileExtension';

interface FileIconProps {
  fileName: string;
}

function FileIcon({fileName}: FileIconProps) {
  const fileExtension = getFileExtension(fileName);
  const iconName = fileExtension ? fileExtensionToPlatform(fileExtension) : null;

  if (!iconName) {
    return <IconFile size="sm" />;
  }

  return <PlatformIcon platform={iconName} size={SvgIcon.ICON_SIZES.sm} />;
}

export default FileIcon;
