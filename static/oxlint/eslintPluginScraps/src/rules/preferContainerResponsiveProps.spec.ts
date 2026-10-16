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
      filename,
      code: "import {useMedia} from 'sentry/utils/useMedia'; useMedia('(hover: hover)');",
    },
    {
      filename,
      code: "import {useMedia} from 'sentry/utils/useMedia'; useMedia('(max-height: 800px)');",
    },
    {
      filename,
      code: "const search = {'app.vitals.start.screen:sm': true};",
    },
    {
      filename,
      code: "const props = {direction: {zero: 'column', 'screen:md': 'row'}};",
    },
    {
      filename: '/project/static/app/components/core/drawer/components.tsx',
      code: "import styled from '@emotion/styled'; const DrawerSlidePanel = styled.div`@media (max-width: 800px) { width: 100%; }`;",
    },
    {
      filename: '/project/static/app/components/core/slideOverPanel/slideOverPanel.tsx',
      code: "import styled from '@emotion/styled'; const _SlideOverPanel = styled.div`@media (max-width: 800px) { width: 100%; }`;",
    },
  ],
  invalid: [
    {
      filename,
      code: "import {css} from '@emotion/react'; const highlightModalCss = css`@media (min-width: 800px) { width: 80%; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@media (prefers-reduced-motion: reduce) { color: red; }`;",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "const style = {'@media (prefers-reduced-motion: reduce)': {color: 'red'}};",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import styled from '@emotion/styled'; const Box = styled.div`@container (max-width: 768px) { color: red; }`;",
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
      code: "import {useMedia as media} from 'sentry/utils/useMedia'; media(`(width < ${theme.breakpoints.md})`);",
      errors: [{messageId: 'forbidden'}],
    },
    {
      filename,
      code: "import {useMedia} from 'sentry/utils/useMedia'; useMedia('(max-width: 800px)');",
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
  ],
});
