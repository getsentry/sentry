// Runtime implementation provided by StoryManifestPlugin's virtual module.
export const storyImports: Record<string, () => Promise<unknown>>;

export const storyFrontmatterIndex: Record<
  string,
  {category?: string; description?: string; title?: string}
>;

export function subscribeToStoriesHmr(listener: () => void): () => void;
export function getStoriesHmrVersion(): number;
