import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {IconArrow} from 'sentry/icons';
import {useStory} from 'sentry/stories/view/useStory';
import {space} from 'sentry/styles/space';

export function StoryFooter() {
  const {story} = useStory();
  if (!story.filename.endsWith('.mdx')) return null;
  const {prev, next} = story.exports.frontmatter ?? {};
  return (
    <Flex align="center" justify="space-between" gap={space(2)}>
      {prev && (
        <Card to={prev.link} icon={<IconArrow direction="left" />}>
          <CardLabel>Previous</CardLabel>
          <CardTitle>{prev.label}</CardTitle>
        </Card>
      )}
      {next && (
        <Card data-flip to={next.link} icon={<IconArrow direction="right" />}>
          <CardLabel>Next</CardLabel>
          <CardTitle>{next.label}</CardTitle>
        </Card>
      )}
    </Flex>
  );
}

const Card = styled(LinkButton)`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 80px;
  margin-bottom: ${space(4)};
  span:last-child {
    width: 100%;
    display: grid;
    grid-template-areas:
      'icon label'
      'icon text';
    grid-template-columns: auto 1fr;
    place-content: center;
    gap: ${space(1)} ${space(2)};
  }
  &[data-flip] span:last-child {
    grid-template-areas:
      'label icon'
      'text icon';
    grid-template-columns: 1fr auto;
    justify-content: flex-end;
    text-align: right;
  }
  span:has(svg) {
    grid-area: icon;
  }
`;
const CardLabel = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
`;
const CardTitle = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: 20px;
`;
