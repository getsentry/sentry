import type {ComponentProps, ReactElement, ReactNode} from 'react';
import {Fragment, isValidElement} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {IconLink} from 'sentry/icons';
import {useStory} from 'sentry/stories/view/useStory';
import slugify from 'sentry/utils/slugify';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export function StoryHeading(props: ComponentProps<typeof Heading>) {
  const {story} = useStory();

  const storyTitle = (story.exports.frontmatter as any)?.title;
  const text = stringifyReactNode(props.children);
  const id = props.id ?? slugify(text);

  const {copy} = useCopyToClipboard();

  return (
    <Flex gap="md" align="center">
      <Heading {...props} id={id} />
      <StyledLinkButton
        priority="transparent"
        size="xs"
        href={`#${id}`}
        icon={<IconLink />}
        onClick={() =>
          copy(`${window.location.toString().replace(/#.*$/, '')}#${id}`, {
            successMessage: (
              <Fragment>
                Copied link to{' '}
                <strong>
                  {storyTitle ? `${storyTitle} > ` : null}
                  {text}
                </strong>
              </Fragment>
            ),
          })
        }
      />
    </Flex>
  );
}

const StyledLinkButton = styled(LinkButton)`
  position: relative;
  opacity: 0;
  width: 32px;
  height: 32px;

  /* Show self on hover/focus and on sibling hover */
  &:is(:hover, :focus),
  *:is(:hover) ~ & {
    opacity: 1;
  }

  /* Extend hitbox by 8px on each side */
  &::before {
    position: absolute;
    inset: -8px;
    content: '';
    display: block;
  }
`;

function stringifyReactNode(child?: ReactNode): string {
  switch (true) {
    case typeof child === 'string':
      return child;
    // 0 is a valid child that should be stringified
    case typeof child === 'number':
      return child.toString();
    case !child:
      return '';
    case Array.isArray(child):
      return child.map(c => stringifyReactNode(c)).join('');
    case hasChildren(child):
      return stringifyReactNode(child.props.children);
    default:
      return '';
  }
}

function hasChildren(node: ReactNode): node is ReactElement<{children: ReactNode}> {
  return (
    isValidElement<{children?: ReactNode}>(node) &&
    node.props.children !== null &&
    node.props.children !== undefined
  );
}
