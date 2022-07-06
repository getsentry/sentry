import styled from '@emotion/styled';
/* eslint-disable-next-line import/default */
import LinkTo from '@storybook/addon-links/react';

import {IconArrow} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

type Link = {
  /**
   * props to pass to LinkTo:
   *
   * if the target is a docs page (.mdx file),
   * then kind = page title (e.g. 'Core/Overview', as defined in the Meta tag),
   * and story = 'page'
   *
   * if the target is a story (.js(x)/.ts(x) file),
   * then kind = story page title (from the title key in the default export)
   * and story = a story name (defined with .storyName) or just 'default'
   */
  kind: string;
  story: string;
  title: string;
  desc?: string;
  img?: {
    alt: string;
    src: string;
  };
};

type LinkProps = Link;

type Props = {
  links: Link[];
  theme: Theme;
};

/**
 * kind defaults to 'Core/Overview', so an empty link will just
 * lead back to the home page
 */
const DocsLink = ({img, title, desc, kind, story}: LinkProps) => (
  <LinkWrap kind={kind} story={story}>
    {img && (
      <ImgWrap>
        <Img src={img.src} alt={img.alt} />
      </ImgWrap>
    )}
    <TitleWrap>
      <Title>{title}</Title>
      <IconWrap>
        <IconArrow color="textColor" direction="right" size="sm" />
      </IconWrap>
    </TitleWrap>
    {desc && <Desc>{desc}</Desc>}
  </LinkWrap>
);

const DocsLinks = ({links}: Props) => (
  <Wrapper>
    {links.map((link, i) => (
      <DocsLink key={i} {...link} />
    ))}
  </Wrapper>
);

export default DocsLinks;

const Wrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: ${space(2)};
  width: 100%;
  margin: ${space(2)} auto;
`;

const LinkWrap = styled(LinkTo)`
  width: calc((100% - ${space(2)} * 2) / 3);
  cursor: pointer;
  margin: ${space(1)} 0;

  @media only screen and (max-width: ${p => p.theme.breakpoints.small}) {
    width: calc((100% - ${space(2)}) / 2);
  }
`;

const ImgWrap = styled('div')`
  position: relative;
  width: 100%;
  padding-top: 50%;
  border: solid 1px ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  transition: 0.2s ease-out;

  ${/* sc-selector */ LinkWrap}:hover & {
    border: solid 1px ${p => p.theme.border};
  }
`;

const Img = styled('img')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TitleWrap = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(2)};
`;

const Title = styled('p')`
  font-weight: 600;
  line-height: 1;
  margin-bottom: 0;
  margin-right: ${space(1)};
`;

const IconWrap = styled('div')`
  display: flex;
  align-items: center;
  transition: 0.2s ease-out;

  ${/* sc-selector */ LinkWrap}:hover & {
    transform: translateX(${space(0.5)});
  }
`;

const Desc = styled('p')`
  margin-top: ${space(0.5)};
  font-size: 0.875rem;
  color: ${p => p.theme.subText};
`;
