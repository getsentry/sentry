import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import LinkTo from '@storybook/addon-links/react';

import {IconArrow} from 'app/icons';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type Link = {
  img?: {
    src: string;
    alt: string;
  };
  title: string;
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
};

type LinkProps = Link & {
  theme: Theme;
};

type Props = {
  links: Link[];
  theme: Theme;
};

/**
 * kind defaults to 'Core/Overview', so an empty link will just
 * lead back to the home page
 */
const DocsLink = ({img, title, kind, story, theme}: LinkProps) => (
  <LinkWrap kind={kind} story={story}>
    {img && (
      <ImgWrap>
        <Img src={img.src} alt={img.alt} />
      </ImgWrap>
    )}
    <TitleWrap>
      <Title>{title}</Title>
      <IconWrap>
        <IconArrow theme={theme} color="gray500" direction="right" />
      </IconWrap>
    </TitleWrap>
  </LinkWrap>
);

const DocsLinks = ({links, theme}: Props) => (
  <Wrapper>
    {links.map((link, i) => (
      <DocsLink key={i} {...link} theme={theme} />
    ))}
  </Wrapper>
);

export default withTheme(DocsLinks);

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

  @media only screen and (max-width: ${p => p.theme.breakpoints[0]}) {
    width: calc((100% - ${space(2)}) / 2);
  }
`;

const ImgWrap = styled('div')`
  position: relative;
  width: 100%;
  padding-top: 50%;
  border: solid 1px ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  transition: 0.2s ease-out;

  ${/* sc-selector */ LinkWrap}:hover & {
    border: solid 1px ${p => p.theme.gray200};
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
  margin-top: ${space(1)};
`;

const Title = styled('h5')`
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
