import {useEffect} from 'react';
import styled from '@emotion/styled';
import tocbot from 'tocbot';

import space from 'app/styles/space';

const Container = styled('div')`
  height: 100%;
  width: 16em;

  @media only screen and (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }
`;

const Content = styled('div')`
  position: fixed;
  top: calc(${space(4)} * 3);

  & > .toc-wrapper > .toc-list {
    padding-left: 0;
    border-left: solid 2px ${p => p.theme.border};
  }
  & .toc-list-item {
    position: relative;
    list-style-type: none;
    margin-left: ${space(2)};
  }
  & .toc-list-item::before {
    content: '';
    position: absolute;
    height: 100%;
    top: 0;
    left: 0;
    transform: translateX(calc(-2px - ${space(2)}));
    border-left: solid 2px ${p => p.theme.textColor};
    opacity: 0;
    transition: opacity 0.2s;
  }
  & .toc-list-item.is-active-li::before {
    opacity: 1;
  }
  & .toc-list-item > a {
    color: ${p => p.theme.subText};
  }
  & .toc-list-item.is-active-li > a {
    font-weight: 600;
    color: ${p => p.theme.textColor};
  }
`;

const Heading = styled('p')`
  font-weight: 600;
  font-size: 0.875em;
  color: ${p => p.theme.textColor};
  text-transform: uppercase;
  margin-bottom: ${space(1)};
`;

const TableOfContents = () => {
  useEffect(() => {
    /** Initialize Tocbot
     * https://tscanlin.github.io/tocbot/
     * */
    tocbot.init({
      tocSelector: '.toc-wrapper',
      contentSelector: '.sbdocs-content',
      headingSelector: 'h2',
      headingsOffset: 40,
      scrollSmoothOffset: -40,
      /** Ignore headings that did not
       * come from the main markdown code.
       * */
      ignoreSelector: ':not(.sbdocs), .hide-from-toc',
      orderedList: false,
      /** Prevent default linking behavior,
       * leaving only the smooth scrolling.
       *  */
      onClick: () => false,
    });
  });

  return (
    <Container>
      <Content>
        <Heading>Contents</Heading>
        <div className="toc-wrapper" />
      </Content>
    </Container>
  );
};

export default TableOfContents;
