import type {ComponentProps} from 'react';
import {Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {IconLink} from 'sentry/icons';
import {useStory} from 'sentry/stories/view/useStory';
import slugify from 'sentry/utils/slugify';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export function StoryHeading(props: ComponentProps<typeof Heading>) {
  const {story} = useStory();
  const storyTitle = (story.exports.frontmatter as any)?.title;
  const text = stringifyChildren(props.children);
  const id = props.id ?? slugify(text.replace(/\s+/g, '-'));
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
    <HeadingContainer gap="md" align="center">
      <Heading {...props} id={id} />
      <LinkButton priority="transparent" size="xs" href={`#${id}`} onClick={onClick}>
        <IconLink />
      </LinkButton>
    </HeadingContainer>
  );
}

const HeadingContainer = styled(Flex)`
  > a {
    opacity: 0;
    color: ${p => p.theme.tokens.graphics.muted};
  }

  &:is(:hover, :focus-within) > a {
    opacity: 1;
  }

  a:is(:hover, :focus) {
    color: ${p => p.theme.tokens.graphics.accent};
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    flex-direction: row;
    margin-left: -40px;

    > a {
      width: 32px;
      height: 32px;
      order: -1;
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
