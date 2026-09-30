import {RuleTester} from 'oxlint/plugins-dev';

import {preferPrimitives} from './preferPrimitives';

const ruleTester = new RuleTester({
  languageOptions: {parserOptions: {ecmaFeatures: {jsx: true}}},
});
const emotion =
  "import styled from '@emotion/styled'; import {css} from '@emotion/react';\n";
function invalid(
  name: string,
  code: string,
  primitive: string
): RuleTester.InvalidTestCase {
  return {
    name,
    code,
    filename: 'example.tsx',
    errors: [
      {
        messageId:
          primitive === 'Button'
            ? 'preferButton'
            : primitive === 'Heading'
              ? 'preferHeading'
              : 'preferPrimitive',
        ...(primitive === 'Button' || primitive === 'Heading'
          ? {}
          : {
              data: {
                primitive,
                source: `@sentry/scraps/${primitive === 'Text' ? 'text' : 'layout'}`,
              },
            }),
      },
    ],
  };
}

ruleTester.run('prefer-primitives', preferPrimitives, {
  valid: [
    ...['p', 'time', 'legend'].map(element => ({
      name: `layout display on ${element} cannot fall through to Text`,
      code: `${emotion} const F = styled.${element}\`display:flex;font-size:12px;color:red;\`; const G = <${element} style={{display:'grid',fontSize:12,color:'red'}}/>;`,
    })),
    ...['a', 'input', 'svg'].map(element => ({
      name: `layout primitives cannot preserve an unsupported ${element} tag`,
      code: `${emotion} const F = styled.${element}\`display:flex;\`; const S = styled.${element}\`display:flex;flex-direction:column;\`; const G = <${element} style={{display:'grid'}}/>; const C = <${element} style={{padding:8,borderRadius:4}}/>;`,
    })),
    {
      name: 'shared definitions must support every intrinsic tag',
      code: 'const styles = {display:"flex"}; const C = <><div style={styles}/><a style={styles}/></>;',
    },
    {
      name: 'mixed JSX styles and prop spreads can override evidence',
      code: `const C = <><div css={{display:'flex'}} style={{display:'block'}}/><div style={{display:'flex'}} {...props}/></>;`,
    },
    {
      name: 'important declarations require cascade analysis',
      code: emotion + 'const C = styled.div`display:block!important;display:flex;`',
    },
    {
      name: 'object prototype names are not typography properties',
      code: `const C = <div style={{constructor:'x',toString:'y'}}/>;`,
    },
    {
      name: 'all resets invalidate display evidence',
      code: `const C = <div style={{display:'flex', all:'unset'}}/>;`,
    },
    {
      name: 'template all reset invalidates display',
      code: emotion + 'const C = styled.div`display:flex;all:unset;`',
    },
    {
      name: 'escaping objects may be mutated by calls',
      code: `const styles = {display:'flex'}; Object.assign(styles,{display:'block'}); const C = <div style={styles}/>;`,
    },
    {
      name: 'escaping aliases may mutate the original',
      code: `const styles = {display:'flex'}; const alias = styles; Object.assign(alias,{display:'block'}); const C = <div style={styles}/>;`,
    },

    {
      name: 'const objects with property access may be mutated',
      code: `const styles = {display:'flex'}; styles.display = 'block'; const C = <div style={styles}/>;`,
    },
    {
      name: 'a TS assertion keeps its lexical binding',
      filename: 'example.tsx',
      code: `let styles = {display:'flex'} as const; const C = <div style={styles}/>;`,
    },
    {
      name: 'arbitrary objects are data, not style sites',
      code: 'const data = {display: "flex", padding: 8, backgroundColor: "red"};',
    },
    {
      name: 'unrelated APIs with familiar names',
      code: 'const styled = library(); const x = styled.div`display:flex;gap:8px`; const y = css`display:grid`;',
    },
    {
      name: 'Emotion imports can be shadowed',
      code: `${emotion} function component(styled, css) { const x = styled.div\`display:flex;gap:8px\`; return <div css={css\`display:grid\`} />; }`,
    },
    {
      name: 'styles on custom components and primitives',
      code: `${emotion} const Custom = styled(Button)\`display:flex;gap:8px\`; const C = <><Button style={{display:'grid'}}/><Flex css={{display:'flex'}}/><Other css={css\`display:flex;gap:8px\`}/></>;`,
    },
    {
      name: 'styles on custom components do not activate a shared definition',
      code: `${emotion} const styles = css\`display:flex;gap:8px\`; const C = <Other css={styles}/>;`,
    },
    {
      name: 'shadowed style object does not activate the outer definition',
      code: `const styles = {display:'flex'}; function Component(styles) {return <div style={styles}/>;}`,
    },
    {
      name: 'scoped bindings do not share declarations',
      code: `function A() {const styles = {display:'flex'}; return <Other style={styles}/>;} function B() {const styles = {width:10}; return <div style={styles}/>;}`,
    },
    {
      name: 'nested rules, strings and comments are not root declarations',
      code: `${emotion} const C = styled.div\`content: "display:flex;gap:8px"; /* display:grid;gap:8px */ &:hover { display:flex; gap:8px; }\`;`,
    },
    {
      name: 'interpolation cannot concatenate into a property or display value',
      code: `${emotion} const A = styled.div\`dis\${middle}play:flex;gap:8px;\`; const B = styled.div\`display:fl\${middle}ex;gap:8px;\`;`,
    },
    {
      name: 'dynamic display is not assumed to be flex',
      code: `${emotion} const C = styled.div\`display: \${p=>p.display}; gap:8px;\`;`,
    },
    {
      name: 'style fragments can override static declarations',
      code: `${emotion} const C = styled.div\`display:flex; \${other};\`;`,
    },
    {
      name: 'unknown spreads or computed keys can override styles',
      code: `const C = <><div css={{display:'flex', ...other}}/><div style={{display:'flex', [key]: value}}/></>;`,
    },
    {
      name: 'unsupported logical padding and margins are not Container evidence',
      code: `const C = <div style={{paddingInline:8, borderStartStartRadius:4, marginTop:8, marginBottom:8}}/>;`,
    },
    {
      name: 'gap and margin do not imply Stack or Flex',
      code: `const C = <div style={{gap:8, marginTop:8, marginBottom:8, alignContent:'center'}}/>;`,
    },
    {
      name: 'unsupported typography does not imply Text',
      code: `const C = <span style={{letterSpacing:1, hyphens:'auto', fontStyle:'oblique'}}/>;`,
    },
    {
      name: 'typography on non-text elements is not Text',
      code: `const C = <input style={{fontSize:12, color:'red'}}/>;`,
    },
    {
      name: 'a single spacing declaration is not Container',
      code: `const C = <div style={{padding:8}}/>;`,
    },
    {
      name: 'repeated declarations only count once',
      code: `${emotion} const C = styled.div\`padding:8px; padding:16px;\`;`,
    },
    {
      name: 'later dynamic declarations replace earlier display evidence',
      code: `${emotion} const C = styled.div\`display:flex;display:\${value};gap:8px;\`;`,
    },
    {
      name: 'CSS syntax errors do not crash unrelated source',
      code: `${emotion} const C = styled.div\`padding 8px; broken: {;\`; const D = <div/>;`,
    },
  ],
  invalid: [
    invalid(
      'quoted camelCase typography keys',
      '<span style={{"fontSize":14,"fontWeight":500}}/>',
      'Text'
    ),
    invalid(
      'quoted camelCase container keys',
      '<div style={{"backgroundColor":"red","borderRadius":4}}/>',
      'Container'
    ),
    invalid(
      'quoted camelCase flex direction',
      '<div style={{display:"flex","flexDirection":"column"}}/>',
      'Stack'
    ),
    invalid('td is a supported layout tag', '<td style={{display:"grid"}}/>', 'Grid'),
    invalid(
      'generic intrinsic styled template',
      emotion + 'const C = styled.div<{gap: number}>`display:flex; gap:${p=>p.gap};`;',
      'Flex'
    ),
    invalid(
      'font weight supported by the current Text API',
      '<span style={{fontSize:14,fontWeight:500}}>Text</span>',
      'Text'
    ),
    invalid(
      'TypeScript const assertion on a style object',
      'const styles = {display:"flex"} as const; const C = <div style={styles}/>;',
      'Flex'
    ),
    invalid(
      'raw button is one finding even with layout styles',
      '<button type="submit" style={{display:"flex",gap:8}}>Save</button>',
      'Button'
    ),
    invalid(
      'raw heading preserves the semantic level',
      '<h3 style={{fontSize:20,color:"red"}}>Title</h3>',
      'Heading'
    ),
    invalid(
      'styled button gets one finding regardless of usage count',
      `${emotion} const C = styled.button\`display:flex;gap:8px;\`; const x = <><C/><C/></>;`,
      'Button'
    ),
    invalid(
      'styled heading call',
      `${emotion} const C = styled('h2')({fontSize:20});`,
      'Heading'
    ),
    invalid(
      'aliased Emotion import',
      "import make from '@emotion/styled'; const C = make.div`display:flex;gap:8px;`;",
      'Flex'
    ),
    invalid(
      'Stack takes precedence over Flex and Container',
      `${emotion} const C = styled.div\`display:flex;flex-direction:column;padding:8px;background-color:red;\`;`,
      'Stack'
    ),
    invalid(
      'column-reverse is Flex',
      `${emotion} const C = styled('div')\`display:inline-flex;flex-direction:column-reverse;\`;`,
      'Flex'
    ),
    invalid(
      'Grid takes precedence over Container',
      `${emotion} const C = styled.div({display:'inline-grid', padding:8, backgroundColor:'red'});`,
      'Grid'
    ),
    invalid(
      'styled callback object',
      `${emotion} const C = styled.div(props => ({display:'flex', gap:props.gap}));`,
      'Flex'
    ),
    invalid(
      'current Container replaces Box',
      `${emotion} const C = styled.div\`padding:8px;border-radius:4px;\`;`,
      'Container'
    ),
    invalid(
      'supported text-capable element',
      '<time style={{fontSize:12,color:"red"}}>Today</time>',
      'Text'
    ),
    invalid(
      'font style and uppercase are supported typography',
      '<span style={{fontStyle:"italic",textTransform:"uppercase"}}>Text</span>',
      'Text'
    ),
    invalid(
      'aliased css import attached to an intrinsic element',
      "import {css as makeCss} from '@emotion/react'; const C = <div css={makeCss`display:grid;gap:8px;`}/>;",
      'Grid'
    ),
    invalid(
      'namespace css import',
      "import * as emotion from '@emotion/react'; const C = <div css={emotion.css({display:'flex'})}/>;",
      'Flex'
    ),
    invalid(
      'value interpolations preserve declaration boundaries',
      `${emotion} const C = styled.div\`display:flex; gap:\${p=>p.gap};\`;`,
      'Flex'
    ),
    invalid(
      'forward const style references report at their definition once',
      'const C = <><div style={styles}/><div style={styles}/></>; const styles = {display:"flex",gap:8};',
      'Flex'
    ),
    invalid(
      'style aliases resolve to one definition',
      'const original = {display:"grid"}; const alias = original; const C = <><div style={alias}/><div style={original}/></>;',
      'Grid'
    ),
    invalid(
      'css variable reused by styled and JSX is one definition',
      `${emotion} const shared = css\`display:flex;gap:8px;\`; const C = styled.div(shared); const x = <div css={shared}/>;`,
      'Flex'
    ),
    {
      name: 'copied declarations remain separate findings',
      code: 'const a = {display:"flex"}; const b = {display:"flex"}; const C = <><div style={a}/><div style={b}/></>;',
      filename: 'example.tsx',
      errors: [{messageId: 'preferPrimitive'}, {messageId: 'preferPrimitive'}],
    },
  ],
});
