import {RuleTester} from 'oxlint/plugins-dev';

import {noManualTable} from './noManualTable';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('no-manual-table', noManualTable, {
  valid: [
    {
      name: 'SimpleTable',
      code: `
        import {SimpleTable} from 'sentry/components/tables/simpleTable';
        const x = <SimpleTable><SimpleTable.Row /></SimpleTable>;
      `,
    },
    {
      name: 'a single Grid with a column template',
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid columns="1fr 200px 150px">child</Grid>;
      `,
    },
    {
      name: 'two Grids sharing a two-track template',
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid columns="1fr 1fr">a</Grid>;
        const y = <Grid columns="1fr 1fr">b</Grid>;
      `,
    },
    {
      name: 'two Grids sharing a constant two-track template',
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const COLUMNS = '1fr auto';
        const x = <Grid columns={COLUMNS}>a</Grid>;
        const y = <Grid columns={COLUMNS}>b</Grid>;
      `,
    },
    {
      name: 'a Grid from another package',
      code: `
        import {Grid} from 'other-package';
        const header = <Grid columns="1fr 200px 150px">a</Grid>;
        const rows = items.map(item => <Grid columns="1fr 200px 150px">{item}</Grid>);
      `,
    },
    {
      name: 'a PanelHeader styled without a column template',
      code: `
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        const StyledPanelHeader = styled(PanelHeader)\`
          justify-content: space-between;
        \`;
      `,
    },
    {
      name: 'two Grids sharing a template where neither repeats',
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid columns="1fr 200px 150px">a</Grid>;
        const y = <Grid columns="1fr 200px 150px">b</Grid>;
      `,
    },
    {
      name: 'mapped Grids sharing a template without a header',
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const rows = items.map(item => <Grid columns="1fr 200px 150px">{item}</Grid>);
        const more = others.map(item => <Grid columns="1fr 200px 150px">{item}</Grid>);
      `,
    },
    {
      name: 'a full-width subgrid row',
      code: `
        import styled from '@emotion/styled';
        const Row = styled('div')\`
          grid-column: 1 / -1;
          grid-template-columns: subgrid;
        \`;
      `,
    },
    {
      name: 'a styled div with a unique column template',
      code: `
        import styled from '@emotion/styled';
        const Layout = styled('div')\`
          display: grid;
          grid-template-columns: 1fr 200px 150px;
        \`;
      `,
    },
  ],
  invalid: [
    {
      name: 'a raw table',
      code: `const x = <table><tr><th>Name</th></tr></table>;`,
      errors: [
        {messageId: 'tableElement', data: {element: 'table'}},
        {messageId: 'tableElement', data: {element: 'tr'}},
        {messageId: 'tableElement', data: {element: 'th'}},
      ],
    },
    {
      name: 'a styled table',
      code: `
        import styled from '@emotion/styled';
        const Table = styled('table')\`
          width: 100%;
        \`;
      `,
      errors: [{messageId: 'tableElement', data: {element: 'table'}}],
    },
    {
      name: 'an element rendered as a table row',
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex as="tr">a</Flex>;
      `,
      errors: [{messageId: 'tableElement', data: {element: 'tr'}}],
    },
    {
      name: 'a PanelHeader laid out as columns',
      code: `
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        const StyledPanelHeader = styled(PanelHeader)\`
          display: grid;
          grid-template-columns: \${GRID_TEMPLATE};
        \`;
      `,
      errors: [{messageId: 'panelHeaderColumns'}],
    },
    {
      name: 'a PanelHeader styled with a local grid mixin',
      code: `
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        const LAYOUT = \`
          display: grid;
          grid-template-columns: 1fr 100px 200px;
        \`;
        const TeamPanelHeader = styled(PanelHeader)\`
          \${LAYOUT}
        \`;
      `,
      errors: [{messageId: 'panelHeaderColumns'}],
    },
    {
      name: 'a PanelHeader styled with an imported grid mixin',
      code: `
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        import {GRID_TEMPLATE} from './row';
        const StyledPanelHeader = styled(PanelHeader)\`
          \${GRID_TEMPLATE}
        \`;
      `,
      errors: [{messageId: 'panelHeaderColumns'}],
    },
    {
      name: 'a header Grid and mapped row Grids sharing a template literal',
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = <Grid columns="1fr repeat(2, 120px)">a</Grid>;
        const rows = items.map(item => <Grid columns="1fr repeat(2, 120px)">{item}</Grid>);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      name: 'a header Grid and mapped row Grids sharing a responsive template',
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = <Grid columns={{zero: 'repeat(4, 1fr)', sm: 'repeat(5, 1fr)'}}>a</Grid>;
        const rows = items.flatMap(item => [
          <Grid columns={{zero: 'repeat(4, 1fr)', sm: 'repeat(5, 1fr)'}}>{item}</Grid>,
        ]);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      name: 'a styled header and a mapped styled row sharing a constant',
      code: `
        import styled from '@emotion/styled';
        const GRID_TEMPLATE = 'minmax(100px, 1fr) 200px 150px';
        const Header = styled('div')\`
          grid-template-columns: \${GRID_TEMPLATE};
        \`;
        const Row = styled('div')\`
          grid-template-columns: \${GRID_TEMPLATE};
        \`;
        const x = <div><Header />{items.map(item => <Row key={item} />)}</div>;
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
  ],
});
