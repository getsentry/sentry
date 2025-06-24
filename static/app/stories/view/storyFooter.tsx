import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {IconArrow} from 'sentry/icons';
import {useStory} from 'sentry/stories/view/useStory';
import {space} from 'sentry/styles/space';

export function StoryFooter() {
  const {story} = useStory();
  if (!story.filename.endsWith('.mdx')) return null;
  return (
    <Flex align="center" justify="space-between" gap={space(2)}>
      <Card href="#" icon={<IconArrow direction="left" />}>
        <CardLabel>Previous</CardLabel>
        <CardTitle>Banner</CardTitle>
      </Card>
      <Card data-flip href="#" icon={<IconArrow direction="right" />}>
        <CardLabel>Next</CardLabel>
        <CardTitle>Card</CardTitle>
      </Card>
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
    column-gap: ${space(1)};
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
