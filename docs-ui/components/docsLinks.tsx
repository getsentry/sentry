import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {linkTo} from '@storybook/addon-links';

import {IconArrow} from 'app/icons';
import {Theme} from 'app/utils/theme';

type Link = {
  img: {
    src: string;
    alt: string;
  };
  title: string;
  theme: Theme;
  // props to pass to linkTo
  to: string[];
};

type Props = {
  links: Link[];
  theme: Theme;
};

const DocsLink = ({img, title, to, theme}: Link) => (
  <LinkWrap onClick={linkTo(to[0], to[1])}>
    <ImgWrap>
      <Img src={img.src} alt={img.alt} />
    </ImgWrap>
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
    {links.map((link, ind) => (
      <DocsLink key={ind} {...link} theme={theme} />
    ))}
  </Wrapper>
);

export default withTheme(DocsLinks);

const Wrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 1em;
  width: 100%;
  margin: 1em auto;
`;

const LinkWrap = styled('div')`
  width: calc((100% - 2em) / 3);
  cursor: pointer;
  margin: 0.5em 0;

  @media only screen and (max-width: ${p => p.theme.breakpoints[0]}) {
    width: calc((100% - 1em) / 2);
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

  ${LinkWrap}:hover & {
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
  margin-top: 0.5em;
`;

const Title = styled('h5')`
  line-height: 1;
  margin-bottom: 0;
  margin-right: 0.5em;
`;

const IconWrap = styled('div')`
  display: flex;
  align-items: center;
  transition: 0.2s ease-out;

  ${LinkWrap}:hover & {
    transform: translateX(0.25em);
  }
`;
