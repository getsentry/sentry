import type {ComponentProps} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Heading} from 'sentry/components/core/text';
import {IconLink} from 'sentry/icons';
import slugify from 'sentry/utils/slugify';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';

export function StoryHeading(props: ComponentProps<typeof Heading>) {
  const id = props.id ?? slugify(renderToStaticMarkup(props.children));
  const location = useLocation();
  const {onClick} = useCopyToClipboard({
    text: `${window.location}#${id}`,
    successMessage: `Copied \`#${id}\` link to clipboard`,
  });
  return (
    <HeadingLink to={{...location, hash: id}} onClick={onClick}>
      <IconLink />
      <Heading {...props} id={id} />
    </HeadingLink>
  );
}

const HeadingLink = styled(Link)`
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
