import {RuleTester} from 'oxlint/plugins-dev';

import {preferContainerResponsiveProps} from './preferContainerResponsiveProps';

const ruleTester = new RuleTester();
const filename = '/project/static/app/views/example.tsx';

ruleTester.run('prefer-container-responsive-props', preferContainerResponsiveProps, {
  valid: [
    {
      filename,
      code: "import {css} from '@emotion/react'; const modalCss = css`@media (min-width: 800px) { width: 80%; }`;",
    },
    {
      filename: '/project/static/gsApp/actionCreators/modal.tsx',
      code: "import {css} from '@emotion/react'; const onDemandBudgetEditModalCss = theme => css`@media (min-width: 800px) { width: 800px; }`;",
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const modalCss = css`@media (min-width: 800px) { width: 80%; } @media (prefers-reduced-motion: reduce) { animation: none; }`;",
    },
    {
      filename,
      code: "import {useMedia} from '@sentry/scraps/useMedia'; useMedia('(hover: hover)');",
    },
    {
      filename,
      code: "import {useMedia} from '@sentry/scraps/useMedia'; function check(useMedia) { useMedia('(max-width: 800px)'); }",
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; function makeStyles(css) { return css`@media (max-width: 800px) { width: 100%; }`; }",
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media (prefers-reduced-motion: reduce) { animation: none; } @media (prefers-color-scheme: dark) { color: white; }`;",
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media (hover: hover) and (pointer: fine) { cursor: pointer; }`;",
    },
    {
      filename,
      code: "const style = {'@media (prefers-reduced-motion: reduce)': {animation: 'none'}, '@media (hover: hover) and (pointer: fine)': {cursor: 'pointer'}, '@media (prefers-color-scheme: dark)': {color: 'white'}};",
    },
    {
      filename,
      code: "import {useMedia} from '@sentry/scraps/useMedia'; useMedia('(max-height: 800px)');",
    },
    {
      filename,
      code: "const search = {'app.vitals.start.screen:sm': true};",
    },
    {
      filename: '/project/static/packages/scraps/src/layout/styles.spec.tsx',
      code: "const props = {direction: {'screen:md': 'row'}};",
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const styles = css`/* Use @container only through responsive props. */ color: red;`;",
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const styles = css`content: '@media (max-width: 800px)';`;",
    },
    {
      filename: '/project/static/app/components/core/drawer/components.tsx',
      code: "import styled from '@emotion/styled'; const DrawerSlidePanel = styled.div`@media (max-width: 800px) { width: 100%; }`;",
    },
    {
      filename: '/project/static/app/components/core/drawer/components.tsx',
      code: "import styled from '@emotion/styled'; const DrawerContainer = styled.div`@media (max-width: 800px) { overflow-x: auto; pointer-events: auto; }`;",
    },
    {
      filename: '/project/static/app/components/core/slideOverPanel/slideOverPanel.tsx',
      code: "import styled from '@emotion/styled'; const _SlideOverPanel = styled.div`@media (max-width: 800px) { width: 100%; }`;",
    },
  ],
  invalid: [
    {
      filename,
      code: "const props = {direction: {zero: 'column', 'screen:md': 'row'}};",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const highlightModalCss = css`@media (min-width: 800px) { width: 80%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media (hover: hover) and (max-width: 800px) { color: red; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "const style = {'@media (prefers-color-scheme: dark) and (max-width: 800px)': {color: 'red'}};",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@container (max-width: 768px) { color: red; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@supports (display: grid) { @container (max-width: 768px) { color: red; } }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "const style = {'@container (max-width: 768px)': {display: 'none'}};",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media (max-width: 800px) { width: 100%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const style = css`@media (min-width: ${theme.breakpoints.sm}) { display: flex; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media (width < 800px) { width: 100%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media screen and (orientation: landscape) and (max-width: 800px) { width: 100%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {useMedia as media} from '@sentry/scraps/useMedia'; media(`(width < ${theme.breakpoints.md})`);",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {useMedia} from '@sentry/scraps/useMedia'; useMedia('(max-width: 800px)');",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "const style = {'@media (max-width: 800px)': {display: 'none'}};",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const modalCss = css`@container (min-width: 800px) { width: 80%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const modalCss = css`@media (min-width: 800px) { width: 80%; } @container (min-width: 800px) { width: 90%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {css} from '@emotion/react'; const modalCss = css`@media (min-width: 800px) { display: flex; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename: '/project/static/app/components/core/drawer/components.tsx',
      code: "import styled from '@emotion/styled'; const DrawerContent = styled.div`@media (max-width: 800px) { display: none; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename: '/project/static/app/components/core/drawer/components.tsx',
      code: "import styled from '@emotion/styled'; const DrawerSlidePanel = styled.div`@container (max-width: 800px) { width: 100%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename: '/project/static/app/components/core/drawer/components.tsx',
      code: "import styled from '@emotion/styled'; const DrawerSlidePanel = styled.div`@media (max-width: 800px) { width: 100%; } @media (max-width: 900px) { color: red; }`;",
      errors: [{messageId: 'forbidden'}, {messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Svg = styled.svg`@media (max-height: 600px) and (max-width: 1000px) { margin-left: 40%; } @media (max-height: 600px) and (max-width: 1300px) { margin-top: 240px; }`;",
      errors: [{messageId: 'forbidden'}, {messageId: 'forbidden'}],
    },
    {
      filename: '/project/static/app/views/example.spec.tsx',
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media (max-width: 800px) { width: 100%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
