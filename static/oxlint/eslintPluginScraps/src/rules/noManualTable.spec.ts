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
      code: `
        import {SimpleTable} from 'sentry/components/tables/simpleTable';
        const x = <SimpleTable><SimpleTable.Row /></SimpleTable>;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid columns="1fr 200px 150px">child</Grid>;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid columns="1fr 1fr">a</Grid>;
        const y = <Grid columns="1fr 1fr">b</Grid>;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const COLUMNS = '1fr auto';
        const x = <Grid columns={COLUMNS}>a</Grid>;
        const y = <Grid columns={COLUMNS}>b</Grid>;
      `,
    },
    {
      code: `
        import {Grid} from 'other-package';
        const header = <Grid columns="1fr 200px 150px">a</Grid>;
        const rows = items.map(item => <Grid columns="1fr 200px 150px">{item}</Grid>);
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        const StyledPanelHeader = styled(PanelHeader)\`
          justify-content: space-between;
        \`;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid columns="1fr 200px 150px">a</Grid>;
        const y = <Grid columns="1fr 200px 150px">b</Grid>;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const rows = items.map(item => <Grid columns="1fr 200px 150px">{item}</Grid>);
        const more = others.map(item => <Grid columns="1fr 200px 150px">{item}</Grid>);
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Row = styled('div')\`
          grid-column: 1 / -1;
          grid-template-columns: subgrid;
        \`;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = <Grid columns={{zero: '1fr', sm: '1fr auto'}}>a</Grid>;
        const rows = items.map(item => <Grid columns={{zero: '1fr', sm: '1fr auto'}}>{item}</Grid>);
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const COLUMNS = {zero: '1fr', sm: '1fr auto'};
        const header = <Grid columns={COLUMNS}>a</Grid>;
        const rows = items.map(item => <Grid columns={COLUMNS}>{item}</Grid>);
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Row = styled('div')\`
          grid-template-columns: 1fr 200px 150px;
        \`;
        const rows = items.map(item => <Row key={item} />);
      `,
    },
    {
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
      code: `const x = <table><tr><th>Name</th></tr></table>;`,
      errors: [
        {messageId: 'tableElement', data: {element: 'table'}},
        {messageId: 'tableElement', data: {element: 'tr'}},
        {messageId: 'tableElement', data: {element: 'th'}},
      ],
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Table = styled('table')\`
          width: 100%;
        \`;
      `,
      errors: [{messageId: 'tableElement', data: {element: 'table'}}],
    },
    {
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex as="tr">a</Flex>;
      `,
      errors: [{messageId: 'tableElement', data: {element: 'tr'}}],
    },
    {
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
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = <Grid columns="1fr repeat(2, 120px)">a</Grid>;
        const rows = items.map(item => <Grid columns="1fr repeat(2, 120px)">{item}</Grid>);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
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
    {
      code: `
        import styled from '@emotion/styled';
        const Row = styled('div')\`
          grid-template-columns: 1fr 200px 150px;
        \`;
        const x = <div><Row />{items.map(item => <Row key={item} />)}</div>;
      `,
      errors: [{messageId: 'sharedGridTemplate'}],
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const COLUMNS = {zero: '1fr auto', sm: '1fr 120px 120px'};
        const header = <Grid columns={COLUMNS}>a</Grid>;
        const rows = items.map(item => <Grid columns={COLUMNS}>{item}</Grid>);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
  ],
});
