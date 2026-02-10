export type SetupGuideEventParameters = {
  'setup_guide.copy_as_markdown': {
    format: string;
    source: string;
  };
};

export const setupGuideEventMap: Record<keyof SetupGuideEventParameters, string> = {
  'setup_guide.copy_as_markdown': 'Setup Guide: Copy as Markdown',
};
