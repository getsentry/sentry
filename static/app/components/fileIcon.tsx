import {IconFile} from 'sentry/icons';
import {fileExtensionToPlatform, getFileExtension} from 'sentry/utils/fileExtension';
import theme from 'sentry/utils/theme';

type Props = {
  fileName: string;
  className?: string;
  size?: string;
};

function FileIcon({fileName, size: providedSize = 'sm', className}: Props) {
  const fileExtension = getFileExtension(fileName);
  const iconName = fileExtension ? fileExtensionToPlatform(fileExtension) : null;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  if (!iconName) {
    return <IconFile size={size} className={className} />;
  }

  return (
    <img
      src={require(`platformicons/svg/${iconName}.svg`)}
      width={size}
      height={size}
      className={className}
    />
  );
}

export default FileIcon;
