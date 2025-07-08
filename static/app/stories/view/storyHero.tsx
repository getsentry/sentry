export function StoryHero(props: {frontmatter: Record<string, unknown>}) {
  return <div>{JSON.stringify(props.frontmatter)}</div>;
}
