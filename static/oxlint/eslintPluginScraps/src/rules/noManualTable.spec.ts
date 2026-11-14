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
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        function make(PanelHeader) {
          return styled(PanelHeader)\`
            display: grid;
            grid-template-columns: 1fr 100px;
          \`;
        }
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
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid gap="md">a</Grid>;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const x = <Grid columns={3}>a</Grid>;
      `,
    },
    {
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex {...props}>a</Flex>;
      `,
    },
    {
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex as="section">a</Flex>;
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = wrap(<Grid columns="1fr 200px 150px">a</Grid>);
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = <Grid columns={\`1fr auto\`}>a</Grid>;
        const rows = items.map(item => <Grid columns={\`1fr auto\`}>{item}</Grid>);
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = <Grid columns={compact ? COMPACT : FULL}>a</Grid>;
        const rows = items.map(item => <Grid columns={getColumns(item)}>{item}</Grid>);
      `,
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        function Header() {
          const COLUMNS = getHeaderColumns();
          return <Grid columns={COLUMNS}>a</Grid>;
        }
        function Rows() {
          const COLUMNS = getRowColumns();
          return items.map(item => <Grid columns={COLUMNS}>{item}</Grid>);
        }
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        const COLUMNS = '1fr auto';
        const Header = styled('div')\`
          grid-template-columns: \${COLUMNS};
        \`;
        const Row = styled('div')\`
          grid-template-columns: \${COLUMNS};
        \`;
        const x = <div><Header />{items.map(item => <Row key={item} />)}</div>;
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Row = styled('div')\`
          grid-template-columns: 1fr auto;
        \`;
        const x = <div><Row />{items.map(item => <Row key={item} />)}</div>;
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Header = styled('div')\`
          \${gridHeaderLayout};
        \`;
        const Row = styled('div')\`
          \${columnRowLayout};
        \`;
        const x = <div><Header />{items.map(item => <Row key={item} />)}</div>;
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        export default styled('div')\`
          grid-template-columns: 1fr 200px 150px;
        \`;
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Row = styled('div')({gridTemplateColumns: '1fr 200px 150px'});
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Layout = styled(Card)\`
          display: grid;
          grid-template-columns: 1fr 200px 150px;
        \`;
      `,
    },
    {
      code: `
        import {css} from '@emotion/react';
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        const layoutStyles = css\`
          display: flex;
        \`;
        const StyledPanelHeader = styled(PanelHeader)\`
          \${layoutStyles}
        \`;
      `,
    },
    {
      code: `
        import styled from '@emotion/styled';
        import {PanelHeader} from 'sentry/components/panels/panelHeader';
        import {GRID_GAP} from './row';
        const StyledPanelHeader = styled(PanelHeader)\`
          gap: \${GRID_GAP};
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
      errors: [
        {
          messageId: 'tableElement',
          data: {element: 'table'},
          line: 3,
          column: 22,
          endLine: 3,
          endColumn: 37,
        },
      ],
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Base = styled('table');
        const T = Base\`color: red\`;
      `,
      errors: [
        {
          messageId: 'tableElement',
          data: {element: 'table'},
          line: 3,
          column: 21,
          endLine: 3,
          endColumn: 36,
        },
      ],
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
        import * as panels from 'sentry/components/panels/panelHeader';
        const StyledPanelHeader = styled(panels.PanelHeader)\`
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
        import styled from '@emotion/styled';
        const Header = styled.div(\`display: grid; grid-template-columns: 1fr 2fr 3fr;\`);
        const Row = styled.div(\`display: grid; grid-template-columns: 1fr 2fr 3fr;\`);
        const x = <div><Header />{items.map(item => <Row key={item} />)}</div>;
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
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
    {
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex gap="md" as="tr" align="center">a</Flex>;
      `,
      errors: [
        {
          messageId: 'tableElement',
          data: {element: 'tr'},
          line: 3,
          column: 33,
          endLine: 3,
          endColumn: 40,
        },
      ],
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = renderer.wrap(<Grid columns="1fr 200px 150px">a</Grid>);
        const rows = items.map(item => <Grid columns="1fr 200px 150px">{item}</Grid>);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        let COLUMNS = '1fr auto';
        const header = <Grid columns={COLUMNS}>a</Grid>;
        const rows = items.map(item => <Grid columns={COLUMNS}>{item}</Grid>);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      code: `
        import {Grid} from '@sentry/scraps/layout';
        const header = <Grid columns={\`\${first} 1fr 2fr\`}>a</Grid>;
        const rows = items.map(item => <Grid columns={\`\${first} 1fr 2fr\`}>{item}</Grid>);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      code: `
        import styled from '@emotion/styled';
        import {Grid} from '@sentry/scraps/layout';
        const Row = styled('div')\`
          grid-template-columns: 1fr 200px 150px;
        \`;
        const x = <div><Grid columns="1fr  200px 150px" />{items.map(item => <Row key={item} />)}</div>;
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      code: `
        import styled from '@emotion/styled';
        const GRID_TEMPLATE = 'minmax(100px, 1fr) 200px 150px';
        export const Header = styled('div')\`
          grid-template-columns: \${GRID_TEMPLATE};
        \`;
        const Row = styled('div')\`
          grid-template-columns: \${GRID_TEMPLATE};
        \`;
        const x = items.map(item => <Row key={item} />);
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      code: `
        import {css} from '@emotion/react';
        import styled from '@emotion/styled';
        const gridLayout = css\`
          grid-template-columns: 1fr 200px 150px;
        \`;
        const Header = styled('div')\`
          \${gridLayout};
        \`;
        const Row = styled('div')\`
          \${gridLayout};
        \`;
        const x = <div><Header />{items.map(item => <Row key={item} />)}</div>;
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
    {
      code: `
        import {css} from '@emotion/react';
        import styled from '@emotion/styled';
        const gridLayout = css\`
          grid-template-columns: 1fr 200px 150px;
        \`;
        const COLUMNS = '1fr 200px 150px';
        const Header = styled('div')\`
          \${gridLayout};
          grid-template-columns: \${COLUMNS};
        \`;
        const Row = styled('div')\`
          \${gridLayout};
          grid-template-columns: \${COLUMNS};
        \`;
        const x = <div><Header />{items.map(item => <Row key={item} />)}</div>;
      `,
      errors: [{messageId: 'sharedGridTemplate'}, {messageId: 'sharedGridTemplate'}],
    },
  ],
});
