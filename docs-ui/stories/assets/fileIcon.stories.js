import FileIcon from 'sentry/components/fileIcon';

export default {
  title: 'Assets/Icons/File Icon',
  component: FileIcon,
  args: {
    fileName: 'src/components/testComponent.tsx',
    size: 'xl',
  },
};

export const _FileIcon = ({...args}) => <FileIcon {...args} />;

_FileIcon.storyName = 'File Icon';
_FileIcon.parameters = {
  docs: {
    description: {
      story: 'Shows a platform icon for given filename - based on extension',
    },
  },
};
