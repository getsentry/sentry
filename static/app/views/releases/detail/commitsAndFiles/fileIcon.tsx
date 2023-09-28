import {PlatformIcon} from 'platformicons';

import {IconFile} from 'sentry/icons';
import {fileExtensionToPlatform, getFileExtension} from 'sentry/utils/fileExtension';
import theme from 'sentry/utils/theme';

interface FileIconProps {
  fileName: string;
}

function FileIcon({fileName}: FileIconProps) {
  const fileExtension = getFileExtension(fileName);
  const iconName = fileExtension ? fileExtensionToPlatform(fileExtension) : null;

  if (!iconName) {
    return <IconFile size="sm" />;
  }

  return <PlatformIcon platform={iconName} size={theme.iconSizes.sm} />;
}

export default FileIcon;
