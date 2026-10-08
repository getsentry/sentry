import {IconFile} from '@sentry/icons/iconFile';
import {SvgIcon} from '@sentry/icons/svgIcon';
import {PlatformIcon} from 'platformicons';

import {fileExtensionToPlatform, getFileExtension} from 'sentry/utils/fileExtension';

interface FileIconProps {
  fileName: string;
}

export function FileIcon({fileName}: FileIconProps) {
  const fileExtension = getFileExtension(fileName);
  const iconName = fileExtension ? fileExtensionToPlatform(fileExtension) : null;

  if (!iconName) {
    return <IconFile size="sm" />;
  }

  return <PlatformIcon platform={iconName} size={SvgIcon.ICON_SIZES.sm} />;
}
