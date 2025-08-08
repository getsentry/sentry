import {StoryHeading} from './storyHeading';

type HeadingProps = {
  children: React.ReactNode;
};

// Heading levels shifted N+1 for proper semantics on /stories pages
export const storyMdxComponents = {
  h1: (props: HeadingProps) => <StoryHeading as="h2" size="2xl" {...props} />,
  h2: (props: HeadingProps) => <StoryHeading as="h3" size="xl" {...props} />,
  h3: (props: HeadingProps) => <StoryHeading as="h4" size="lg" {...props} />,
  h4: (props: HeadingProps) => <StoryHeading as="h5" size="md" {...props} />,
  h5: (props: HeadingProps) => <StoryHeading as="h6" size="sm" {...props} />,
  h6: (props: HeadingProps) => <StoryHeading as="h6" size="xs" {...props} />,
};
