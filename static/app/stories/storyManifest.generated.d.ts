// Runtime implementation provided by StoryManifestPlugin's virtual module.
export const storyImports: Record<string, () => Promise<unknown>>;
export const storyFiles: string[];

export const storyFrontmatterIndex: Record<
  string,
  {category?: string; figma?: string; title?: string}
>;

export const storyHeadingIndex: Record<
  string,
  Array<{id: string; parents: string[]; title: string}>
>;

export function subscribeToStoriesHmr(listener: () => void): () => void;
export function getStoriesHmrVersion(): number;
