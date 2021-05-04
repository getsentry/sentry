import {IconFile} from 'app/icons';
import {fileExtensionToPlatform, getFileExtension} from 'app/utils/fileExtension';
import theme from 'app/utils/theme';

type Props = {
  fileName: string;
  size?: string;
  className?: string;
};

const FileIcon = ({fileName, size: providedSize = 'sm', className}: Props) => {
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
};

export default FileIcon;
