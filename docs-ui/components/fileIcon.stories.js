import React from 'react';

import FileIcon from 'app/components/fileIcon';

export default {
  title: 'Core/Style/Icons',
  component: FileIcon,
  args: {
    fileName: 'src/components/testComponent.tsx',
    size: 'xl',
  },
};

export const _FileIcon = ({...args}) => <FileIcon {...args} />;

_FileIcon.storyName = 'FileIcon';
_FileIcon.parameters = {
  docs: {
    description: {
      story: 'Shows a platform icon for given filename - based on extension',
    },
  },
};
