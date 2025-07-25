import type {ComponentProps} from 'react';
import {Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import styled from '@emotion/styled';

import {Heading} from 'sentry/components/core/text';
import {IconLink} from 'sentry/icons';
import {useStory} from 'sentry/stories/view/useStory';
import slugify from 'sentry/utils/slugify';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export function StoryHeading(props: ComponentProps<typeof Heading>) {
  const {story} = useStory();
  const storyTitle = (story.exports.frontmatter as any)?.title;
  const text = stringifyChildren(props.children);
  const id = props.id ?? slugify(text.replace(/\s+/, '-'));
  const {onClick} = useCopyToClipboard({
    text: `${window.location.toString().replace(/#.*$/, '')}#${id}`,
    successMessage: (
      <Fragment>
        Copied link to{' '}
        <strong>
          {storyTitle ? `${storyTitle} > ` : null}
          {text}
        </strong>
      </Fragment>
    ),
  });
  return (
    <HeadingLink href={`#${id}`} onClick={onClick}>
      <IconLink />
      <Heading {...props} id={id} />
    </HeadingLink>
  );
}

const HeadingLink = styled('a')`
  display: flex;
  flex-flow: row-reverse;
  justify-content: flex-end;
  align-items: center;
  gap: ${p => p.theme.space.md};

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    display: grid;
    justify-content: flex-start;
    grid-template-columns: ${p => p.theme.space.xl} auto;
    margin-left: calc((${p => p.theme.space.xl} + ${p => p.theme.space.md}) * -1);
  }

  > :first-child {
    opacity: 0;
  }

  &:where(:hover, :focus) {
    > :first-child {
      opacity: 1;
    }
  }
`;

function stringifyChildren(children: React.ReactNode) {
  const markup = renderToStaticMarkup(children);
  const p = new DOMParser();
  const {
    body: {textContent},
  } = p.parseFromString(markup, 'text/html');
  return textContent ?? '';
}
