import React from 'react';

import {IconFile} from 'app/icons';
import theme from 'app/utils/theme';

const FILE_EXTENSION_TO_ICON = {
  jsx: 'react',
  tsx: 'react',
  js: 'javascript',
  ts: 'javascript',
  php: 'php',
  py: 'python',
  vue: 'vue',
  go: 'go',
  java: 'java',
  perl: 'perl',
  rb: 'ruby',
  rs: 'rust',
  rlib: 'rust',
  swift: 'swift',
  h: 'apple',
  m: 'apple',
  mm: 'apple',
  M: 'apple',
  cs: 'csharp',
  ex: 'elixir',
  exs: 'elixir',
};

type Props = {
  fileName: string;
  size?: string;
  className?: string;
};

const FileIcon = ({fileName, size: providedSize = 'sm', className}: Props) => {
  const fileExtension = fileName.split('.').pop();
  const iconName = fileExtension ? FILE_EXTENSION_TO_ICON[fileExtension] : null;
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
