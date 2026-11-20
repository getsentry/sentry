import {RuleTester} from 'oxlint/plugins-dev';

import {noDomCoupling} from './noDomCoupling';

const ruleTester = new RuleTester();
const emotion =
  "import styled from '@emotion/styled'; import {css} from '@emotion/react';\n";
const filename = 'file.tsx';
const errors = [{messageId: 'forbidden'}];

ruleTester.run('no-dom-coupling', noDomCoupling, {
  valid: [
    ...[' ', ' > ', ' + ', ' ~ ', ' || '].flatMap(combinator =>
      [
        '.slot',
        '#slot',
        '[data-slot]',
        '&',
        ':is(.slot, #slot)',
        ':where(.slot)',
        ':nth-last-child(3n of .slot)',
      ].map(subject => ({
        name: `scoped subject after combinator: &${combinator}${subject}`,
        code: emotion + 'const C = css`&' + combinator + subject + ' {color:red;}`;',
        filename,
      }))
    ),
    {
      name: 'callback without a return before a scoped selector',
      code: emotion + 'const C = styled.div`${p => { f(p); }} .slot {color:red;}`;',
      filename,
    },
    {
      name: 'switch branches allow scoped styles and selectors',
      code:
        emotion +
        `function getStyles(mode) {
          switch (mode) {
            case 'active': return {'& > .slot': {color: 'red'}};
            default: return '[data-slot] {color: blue;}';
          }
        }
        const C = <div css={getStyles(mode)} />;
        const D = styled.div\`\${props => {
          switch (props.mode) {
            case 'active': return '.slot';
            default: return '[data-slot]';
          }
        }} {color: red;}\`;`,
      filename,
    },
    {
      name: 'switch branches returning scalar property values are allowed',
      code:
        emotion +
        `const C = css({color: () => {
          switch (mode) {
            case 'active': return 'red';
            default: return 'blue';
          }
        }});`,
      filename,
    },
    {
      name: 'switch branches do not collect returns from unused nested functions',
      code:
        emotion +
        `function getStyles(mode) {
          switch (mode) {
            case 'active': {
              function unused() { return {button: {color: 'red'}}; }
              return {color: 'red'};
            }
            default: return;
          }
        }
        const C = <div css={getStyles(mode)} />;`,
      filename,
    },
    {
      name: 'style helper parameters are not function bindings',
      code:
        emotion +
        'function makeStyles(width){return {width};} const C=css(makeStyles("100%"));',
      filename,
    },
    {
      name: 'Select style helper parameters are property values',
      code:
        emotion +
        'import {Select} from "@sentry/scraps/select"; function makeStyles(width){return {menu:base=>({...base,width})};} const C=<Select styles={makeStyles("100%")}/>;',
      filename,
    },
    {
      name: 'useMemo dependency objects are not styles',
      code:
        emotion +
        'import {useMemo} from "react"; const tokens={color:{primary:"red"},button:{size:12}}; const style=useMemo(()=>({color:tokens.color.primary}),[tokens]); const C=<div css={style}/>;',
      filename,
    },
    {
      name: 'useCallback dependency objects are not styles',
      code:
        emotion +
        'import {useCallback as memoize} from "react"; const tokens={button:{color:"red"}}; const style=memoize(()=>({color:tokens.button.color}),[tokens]); const C=<div css={style}/>;',
      filename,
    },
    {
      name: 'namespace memo ignores dependency css text',
      code:
        emotion +
        'import * as React from "react"; const text="button {color:red;}"; const style=React.useMemo(()=>({content:text}),[text]); const C=<div css={style}/>;',
      filename,
    },
    {
      name: 'property callbacks return scalar values',
      code:
        emotion +
        'const C=styled.div({color:props=>props.theme.color,width:()=>"100%",height:()=>24,"--custom":()=>"red"});',
      filename,
    },
    {
      name: 'property callbacks with blocks return scalar values',
      code:
        emotion +
        'function getColor(){if(active)return "red";return "blue";} const C=styled.div({color:getColor,width:()=>{return 24;}});',
      filename,
    },
    {
      name: 'property callbacks resolve aliases and conditional returns',
      code:
        emotion +
        'const color=()=>active?"red":"blue"; const alias=color; const C=css({color:alias,width:()=>active&&"100%"});',
      filename,
    },
    {
      name: 'escaped class punctuation remains scoped',
      code: emotion + 'const C=css`& > .foo\\\\:bar {color:red;}`;',
      filename,
    },
    {
      name: 'unicode escaped class identifier remains scoped',
      code: emotion + 'const C=css`& > .\\u0066oo {color:red;}`;',
      filename,
    },
    {
      name: 'string css preserves escaped class names',
      code: emotion + 'const C=css("& > .foo\\\\ bar {color:red;}");',
      filename,
    },
    {
      name: 'scoped string selectors with backticks and literal interpolation text',
      code: emotion + 'const C=css(\'[data-label="`${value}"] {color:red;}\');',
      filename,
    },
    {
      name: 'regression: conditional scoped classes',
      code: emotion + 'const C = css`${active ? ".on" : ".off"} {color:red;}`;',
      filename,
    },
    {
      name: 'regression: callback scoped attributes',
      code:
        emotion +
        'const C = styled.div`${p => p.active ? "[data-on]" : "[data-off]"} {color:red;}`;',
      filename,
    },
    {
      name: 'regression: template scoped attribute constant',
      code:
        emotion +
        'const target = `[data-state="${state}"]`; const C = css`${target} {color:red;}`;',
      filename,
    },
    {
      name: 'regression: aliased css mixin',
      code:
        emotion +
        'const base = css`color:red;`; const alias = base; const C = styled.div`${alias} &:hover {color:blue;}`;',
      filename,
    },
    {
      name: 'regression: scoped nth-child subject',
      code: emotion + 'const C = css`& > :nth-child(2n of .slot) {color:red;}`;',
      filename,
    },
    {
      name: 'regression: scoped attribute nth-child subject',
      code: emotion + 'const C = css`& > :nth-child(2n of [data-slot]) {color:red;}`;',
      filename,
    },
    {
      name: 'regression: escaped space in class',
      code: emotion + 'const C = css`& > .foo\\\\ bar {color:red;}`;',
      filename,
    },
    {
      name: 'regression: final class in is scopes subject',
      code: emotion + 'const C = css`& > :is(:first-child .slot) {color:red;}`;',
      filename,
    },
    {
      name: 'regression: dynamic scoped computed object key',
      code: emotion + 'const C = css({[String(active ? ".on" : ".off")]:{color:"red"}});',
      filename,
    },
    {
      name: 'regression: scoped class and attr children',
      code:
        emotion + 'const C = css`& > .slot, & > [data-slot], & > #slot {color:red;}`;',
      filename,
    },
    {
      name: 'regression: empty nth interpolation keeps numeric formula',
      code:
        emotion + 'const C = styled.div`&:nth-child(${p => p.index + 1}) {color:red;}`;',
      filename,
    },
    {
      name: 'regression: scoped nth-child list without child combinator',
      code:
        emotion + 'const C = css`&:nth-child(2n of .slot, [data-slot]) {color:red;}`;',
      filename,
    },
    {
      name: 'block callback scoped branches',
      code:
        emotion +
        'const C = styled.div`${p => {if(p.active) return ".on"; return "[data-off]";}} {color:red;}`;',
      filename,
    },
    {
      name: 'cyclic aliases do not crash',
      code:
        emotion +
        'const first=second; const second=first; const C=css`${first}\n.slot {color:red;}`;',
      filename,
    },
    {
      name: 'nth filter all alternatives scoped',
      code:
        emotion +
        'const C = css`& > :nth-last-child(2n of .slot, [data-slot]) {color:red;}`;',
      filename,
    },
    {
      name: 'scoped string css calls',
      code:
        emotion + 'const C=css("& > .slot {color:red;} & > [data-slot] {color:blue;}");',
      filename,
    },
    {
      name: 'plain template calls with selectors',
      code: emotion + 'const C=css(`& > ${active ? ".on" : ".off"} {color:red;}`);',
      filename,
    },
    {
      name: 'scoped dynamic object template key',
      code:
        emotion +
        'const C=css({[`& > ${active ? ".on" : "[data-off]"}`]:{color:"red"}});',
      filename,
    },
    ...[
      '&:hover',
      '&:focus-visible',
      '&::before',
      '&:nth-child(2n + 1)',
      '&:nth-last-child(-n + 2)',
      '&:not(:first-child)',
      '&:empty',
      '&:lang(en)',
      '&:dir(rtl)',
      '&::part(icon)',
      '.slot',
      '#slot',
      '[data-slot]',
      '& > .slot',
      '& > #slot',
      '& > [data-slot]',
      '& > [role="button"]:first-child',
      '& > :is(.first, [data-slot])',
      '& > :where(#slot, .slot)',
      '.parent:hover &',
      '[data-open] > &',
      '& + .sibling',
      '&:has(> [data-slot])',
      '&:not(.disabled)',
      '&:nth-child(2n of .slot)',
    ].map(selector => ({
      name: `allowed selector: ${selector}`,
      code: emotion + `const C = styled.div\`${selector} { color: red; }\`;`,
      filename,
    })),
    {
      name: 'declarations, strings, comments and media conditions are not selectors',
      code:
        emotion +
        'const C = styled.div`content: "> button *"; /* div > span {} */ background: url("data:image/svg+xml,<svg></svg>"); @media (min-width: 600px) { color: red; &:hover { color: blue; } }`;',
      filename,
    },
    {
      name: 'keyframes are not selectors',
      code:
        emotion +
        'const C = css`@keyframes grow { from {opacity: 0;} 50% {opacity: .5;} to {opacity: 1;} } @-webkit-keyframes fade {from {opacity: 0;} to {opacity: 1;}}`;',
      filename,
    },
    {
      name: 'unrelated bindings are ignored',
      code: 'const styled = {div: x => x}; const css = x => x; const C = styled.div`button {color:red;}`; const x = css`* {color:red;}`;',
      filename,
    },
    {
      name: 'shadowed Emotion imports are ignored',
      code:
        emotion +
        'function example(css, styled) { return [css`button {color:red;}`, styled.div`* {color:red;}`]; }',
      filename,
    },
    {
      name: 'static selector constants can use scoped targets',
      code:
        emotion +
        'const SLOT = "[data-slot]"; const slotClass = ".slot"; const C = styled.div`${SLOT} > ${slotClass} {color:red;}`;',
      filename,
    },
    {
      name: 'values and standalone mixins do not become component selectors',
      code:
        emotion +
        'const shared = css`color: red;`; const C = styled.div`${shared}\n${p => p.active && css`color: blue;`}\n&:hover {color: ${p => p.theme.color};}`;',
      filename,
    },
    {
      name: 'declaration string mixins are not selectors',
      code:
        emotion +
        'const shared = "color: red;"; const C = styled.div`${shared}\n&:hover {color: blue;}`;',
      filename,
    },
    {
      name: 'function mixins before a scoped selector are not component selectors',
      code:
        emotion +
        'function getStyles() { return {color: "red"}; } const C = styled.div`${getStyles}\n&:hover {color: blue;}`;',
      filename,
    },
    {
      name: 'imported function mixins before a scoped selector are ignored',
      code:
        emotion +
        'import {getStyles} from "./styles"; const C = styled.div`${getStyles}\n&:hover {color: blue;}`;',
      filename,
    },
    {
      name: 'object styles allow scoped targets and declarations',
      code:
        emotion +
        'const C = styled.div({color: "red", "& > .slot": {color: "blue"}, "&::before": {content: "div > *"}});',
      filename,
    },
    {
      name: 'css props allow scoped targets without Emotion imports',
      code: 'const C = <div css={{"& > [data-slot]": {color: "red"}}} />;',
      filename,
    },
    {
      name: 'non-style object keys are ignored',
      code: emotion + 'const data = {"div > button": {}, "*": {}};',
      filename,
    },
    {
      name: 'Select slot names are not DOM selectors',
      code: "import {Select} from '@sentry/scraps/select'; const C = <Select styles={{input: base => ({...base, color: 'red'}), menu: base => ({...base, '& > [data-slot]': {color: 'red'}})}} />;",
      filename,
    },
    {
      name: 'CSS object keyframes are not selectors',
      code:
        emotion +
        'const C = css({"@keyframes grow": {from: {opacity: 0}, to: {opacity: 1}}});',
      filename,
    },
    {
      name: 'CSS suppression applies to the next selector',
      code:
        emotion +
        'const C = styled.div`\n/* oxlint-disable-next-line rule-to-test/no-dom-coupling */\nbutton {color:red;}\n`;',
      filename,
    },
    {
      name: 'incomplete CSS does not crash lint',
      code: emotion + 'const C = css`button {color: red;`;',
      filename,
    },
  ],
  invalid: [
    ...[
      {selector: '& > button', target: 'A DOM element selector'},
      {selector: '& > *', target: 'A universal selector'},
      {selector: '& :first-child', target: 'An unscoped selector'},
      {
        selector: '${InnerWrap}',
        objectKey: '[InnerWrap]',
        target: 'A component selector',
      },
    ].flatMap(({selector, objectKey, target}) => [
      {
        name: `template error identifies ${target}`,
        code: emotion + 'const C=css`' + selector + ' {color:red;}`;',
        filename,
        errors: [{messageId: 'forbidden', data: {target}}],
      },
      {
        name: `object error identifies ${target}`,
        code:
          emotion +
          'const C=css({' +
          (objectKey ?? JSON.stringify(selector)) +
          ':{color:"red"}});',
        filename,
        errors: [{messageId: 'forbidden', data: {target}}],
      },
    ]),
    ...[' ', ' > ', ' + ', ' ~ ', ' || '].flatMap(combinator =>
      [
        ':first-child',
        ':not(.a)',
        ':is(.slot, :first-child)',
        ':where(:first-child)',
      ].map(subject => ({
        name: `unscoped subject after combinator: &${combinator}${subject}`,
        code: emotion + 'const C = css`&' + combinator + subject + ' {color:red;}`;',
        filename,
        errors,
      }))
    ),
    ...[
      'p => { f(p); }',
      'p => { return; }',
      'function(p) { f(p); }',
      'getStyles',
      'getStyles()',
    ].map(callback => ({
      name: `callback without a return before a DOM selector: ${callback}`,
      code:
        emotion +
        'function getStyles(p) { f(p); } const C = styled.div`${' +
        callback +
        '} button {color:red;}`;',
      filename,
      errors,
    })),
    {
      name: 'typed style helpers check switch cases and the default branch',
      code: `import type {StrictCSSObject} from '@sentry/scraps/theme';
        export function getStyles(mode): StrictCSSObject {
          switch (mode) {
            case 'active':
            case 'selected': {
              if (enabled) return {button: {color: 'red'}};
              break;
            }
            default: return {svg: {color: 'blue'}};
          }
          return {};
        }`,
      filename,
      errors: [...errors, ...errors],
    },
    {
      name: 'called style helpers check strings and templates in switch branches',
      code: `const getStyles = () => {
          switch (mode) {
            case 'active': return 'button {color: red;}';
            default: return \`svg {color: blue;}\`;
          }
        };
        const C = <div css={getStyles()} />;`,
      filename,
      errors: [...errors, ...errors],
    },
    {
      name: 'selector interpolations check switch branches',
      code:
        emotion +
        `const C = styled.div\`\${props => {
          switch (props.mode) {
            case 'active': return '.slot';
            case 'selected': return 'button';
            default: return '[data-slot]';
          }
        }} {color: red;}\`;`,
      filename,
      errors,
    },
    {
      name: 'switch branches returning objects identify nested style callbacks',
      code:
        emotion +
        `const C = css({button: () => {
          switch (mode) {
            case 'active': return {color: 'red'};
            default: return {color: 'blue'};
          }
        }});`,
      filename,
      errors,
    },
    {
      name: 'Emotion call arguments after the first are still styles',
      code: emotion + 'const C=css({color:"red"},{button:{color:"blue"}});',
      filename,
      errors,
    },
    {
      name: 'memo dependency used as a returned style is still checked',
      code:
        emotion +
        'import {useMemo} from "react"; const shared={button:{color:"red"}}; const style=useMemo(()=>shared,[shared]); const C=<div css={style}/>;',
      filename,
      errors,
    },
    {
      name: 'memoized selectors are still checked without walking dependencies',
      code:
        emotion +
        'import {useMemo} from "react"; const tokens={button:{size:12}}; const style=useMemo(()=>({button:{width:tokens.button.size}}),[tokens]); const C=<div css={style}/>;',
      filename,
      errors,
    },
    {
      name: 'callback styles still check returned selectors',
      code:
        emotion +
        'import {useCallback} from "react"; const tokens={button:{size:12}}; const style=useCallback(()=>({"& > button":{width:tokens.button.size}}),[tokens]); const C=<div css={style}/>;',
      filename,
      errors,
    },
    {
      name: 'nested selector callbacks return objects',
      code: emotion + 'const C=styled.div({button:()=>({color:"red"})});',
      filename,
      errors,
    },
    {
      name: 'nested selector callbacks with blocks return objects',
      code:
        emotion +
        'function getStyles(){if(active)return {color:"red"};return {color:"blue"};} const C=css({button:getStyles});',
      filename,
      errors,
    },
    {
      name: 'nested selector callbacks return serialized styles',
      code: emotion + 'const C=css({button:()=>css({color:"red"})});',
      filename,
      errors,
    },
    {
      name: 'malformed nth of argument does not crash',
      code: emotion + 'const C=css`& > :nth-child(of [data-label=" of "]) {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'incomplete pseudo does not crash: & > :is',
      code: emotion + 'const C=css`& > :is {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'incomplete pseudo does not crash: & > :where',
      code: emotion + 'const C=css`& > :where {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'incomplete pseudo does not crash: & > :is()',
      code: emotion + 'const C=css`& > :is() {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'incomplete pseudo does not crash: & > :nth-child(2n of :is)',
      code: emotion + 'const C=css`& > :nth-child(2n of :is) {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'incomplete pseudo does not crash: & > :nth-child(2n of )',
      code: emotion + 'const C=css`& > :nth-child(2n of ) {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'escaped selector text retains source locations',
      code: emotion + 'const C=css`& > .foo\\\\ bar {color:red;}\nbutton {color:red;}`;',
      filename,
      errors: [{messageId: 'forbidden', line: 3, column: 0, endLine: 3, endColumn: 6}],
    },
    {
      name: 'cooked unicode whitespace exposes a DOM target',
      code: emotion + 'const C=css`& > .foo\\u0020button {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'returned template mixins are checked',
      code:
        emotion +
        'const mixin=p=>`color:red; > button {color:${p.color};}`; const C=styled.div`${mixin}`;',
      filename,
      errors,
    },
    {
      name: 'regression: uppercase component alias',
      code:
        emotion +
        'import {InnerWrap} from "@sentry/scraps/menuListItem"; const TARGET = InnerWrap; const C = css`${TARGET} {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: acronym component import alias',
      code:
        emotion +
        'import {URLButton as target} from "./button"; const C = css`${target}\n[data-child] {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: component callback selector',
      code:
        emotion +
        'const InnerWrap = styled.div``; const C = css`${() => InnerWrap}:hover {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: conditional component selector',
      code:
        emotion +
        'const InnerWrap = styled.div``; const OtherWrap = styled.div``; const C = css`${active ? InnerWrap : OtherWrap}:hover {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: function call component selector',
      code:
        emotion +
        'const InnerWrap = styled.div``; function getInner() {return InnerWrap;} const C = css`${getInner()}:hover {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: dynamic class hides DOM descendant',
      code: emotion + 'const C = styled.div`.${p => p.className} button {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: dynamic class hides DOM child',
      code:
        emotion +
        'const C = styled.div`.${p => p.className}:hover > button {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: uppercase conditional DOM target constant',
      code:
        emotion +
        'const TARGET = active ? "div" : "button"; const C = css`${TARGET} {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: ancestor class in is does not scope subject',
      code: emotion + 'const C = css`& > :is(.parent :first-child) {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: ancestor attribute in where does not scope subject',
      code:
        emotion + 'const C = css`& > :where([data-parent] :nth-child(2)) {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: conditional object selector value',
      code: emotion + 'const C = css({button: active ? {color:"red"} : {color:"blue"}});',
      filename,
      errors,
    },
    {
      name: 'regression: serialized object selector value',
      code: emotion + 'const C = css({button: css({color:"red"})});',
      filename,
      errors,
    },
    {
      name: 'regression: tagged object selector value',
      code: emotion + 'const C = css({button: css`color:red;`});',
      filename,
      errors,
    },
    {
      name: 'regression: member object selector value',
      code:
        emotion +
        'const shared = {buttonStyle:{color:"red"}}; const C = css({button: shared.buttonStyle});',
      filename,
      errors,
    },
    {
      name: 'regression: string css call',
      code: emotion + 'const C = css("button {color:red;}");',
      filename,
      errors,
    },
    {
      name: 'regression: template css call',
      code: emotion + 'const C = css(`button {color:red;}`);',
      filename,
      errors,
    },
    {
      name: 'regression: component target with class remains forbidden',
      code:
        emotion +
        'const InnerWrap = styled.div``; const C = css`${InnerWrap}.slot {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'regression: DOM target with attribute remains forbidden',
      code: emotion + 'const C = css`& > button[data-slot] {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'mixed scoped and DOM alternatives',
      code: emotion + 'const C = css`& > ${active ? ".slot" : "button"} {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'nested alias chain',
      code:
        emotion +
        'import {InnerWrap} from "./inner"; const first=InnerWrap; const SECOND=first; const C=css`${SECOND} {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'nth filter ancestor does not scope subject',
      code:
        emotion +
        'const C = css`& > :nth-child(2n of .parent :first-child) {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'nth filter mixed alternatives unscoped',
      code:
        emotion +
        'const C = css`& > :nth-child(2n of .slot, :first-child) {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'member style containing nested selectors',
      code:
        emotion +
        'const shared={style:{"& > button":{color:"red"}}}; const C=css(shared.style);',
      filename,
      errors,
    },
    ...[
      'button',
      '& button',
      '& > button',
      '> div',
      '> :first-child',
      '& > :not(:last-child)',
      '*',
      '& > *',
      '& *',
      '.slot button',
      'button.slot',
      '& > button[data-slot]',
      '&:hover svg path',
      'div:hover &',
      'button + [data-slot]',
      '&:has(svg)',
      '&:has(> thead + tbody)',
      '&:not(button)',
      '&:is(.slot, button)',
      '& > :is(.slot, :first-child)',
      '&:nth-child(2n of button)',
      '&:nth-child(2n of *)',
      '${InnerWrap}',
      '& > ${Parts.InnerWrap}',
      '${Parent}:hover &',
      '&:has(${InnerWrap})',
    ].map(selector => ({
      name: `forbidden selector: ${selector}`,
      code: emotion + `const C = styled.div\`${selector} { color: red; }\`;`,
      filename,
      errors,
    })),
    {
      name: 'one report per selector block, including selector lists',
      code: emotion + 'const C = styled(Base)`div, button > * {color:red;}`;',
      filename,
      errors,
    },
    {
      name: 'each nested selector block is checked',
      code:
        emotion +
        'const C = styled("div")`@media (min-width: 600px) { button { span {color: red;} } }`;',
      filename,
      errors: [...errors, ...errors],
    },
    {
      name: 'conditional css and dynamic declaration values',
      code:
        emotion +
        'const C = styled(Base)`${p => p.active && css`> button { color: ${p.theme.color}; }`}`;',
      filename,
      errors,
    },
    {
      name: 'Emotion import aliases and namespaces',
      code: "import makeStyled from '@emotion/styled'; import * as emotion from '@emotion/react'; const C = makeStyled.div`button {color:red;}`; const x = emotion.css`* {color:red;}`;",
      filename,
      errors: [...errors, ...errors],
    },
    {
      name: 'lowercase imported component aliases are selectors too',
      code:
        emotion +
        "import {Button as inner} from '@sentry/scraps/button'; const C = css`${inner} {color:red;}`;",
      filename,
      errors,
    },
    {
      name: 'component aliases and local components can use uppercase names',
      code:
        emotion +
        "import {InnerWrap as INNER} from '@sentry/scraps/menuListItem'; const LOCAL = styled.div``; const C = css`${INNER} {color:red;} ${LOCAL} {color:red;}`;",
      filename,
      errors: [...errors, ...errors],
    },
    {
      name: 'component aliases before a scoped selector still couple components',
      code:
        emotion +
        "import {InnerWrap as inner} from '@sentry/scraps/menuListItem'; const C = css`${inner}\n.slot {color:red;}`;",
      filename,
      errors,
    },
    {
      name: 'an uppercase default import is still a component selector',
      code:
        emotion + "import INNER from './inner'; const C = css`${INNER} {color:red;}`;",
      filename,
      errors,
    },
    {
      name: 'a static selector constant can contain DOM targets',
      code: emotion + 'const SLOT = "div > button"; const C = css`${SLOT} {color:red;}`;',
      filename,
      errors,
    },
    ...[
      'const C = styled.div({"& > button": {color: "red"}});',
      'const C = styled(Base)(props => ({"& > *": {color: props.theme.color}}));',
      'const C = css({svg: {color: "red"}});',
      'const C = css({"@media (min-width: 600px)": {button: {color: "red"}}});',
      'const C = <div css={{"& > button": {color: "red"}}} />;',
      'const C = <div css={theme => ({"& > *": {color: theme.color}})} />;',
      'const C = <div css={() => {return {svg: {color: "red"}};}} />;',
      'const C = <div css={[false && {button: {color: "red"}}]} />;',
      'const shared = {button: {color: "red"}}; const C = <div css={{...shared}} />;',
      'const shared = {color: "red"}; const C = css({button: shared});',
      'const C = <div css={shared} />; const shared = {button: {color: "red"}};',
      'const C = <div css={getStyles()} />; function getStyles() { return {button: {color: "red"}}; }',
      'const shared = css({button: {color: "red"}}); const C = <div css={shared} />;',
      'const C = css({[String(InnerWrap)]: {color: "red"}});',
      'const C = css({[String(Parts.InnerWrap)]: {color: "red"}});',
      'const C = css({[`${InnerWrap}`]: {color: "red"}});',
      'const C = css({[InnerWrap]: {color: "red"}});',
    ].map(code => ({name: code, code: emotion + code, filename, errors})),
    {
      name: 'css object props do not need Emotion imports',
      code: 'const C = <div css={{button: {color: "red"}}} />;',
      filename,
      errors,
    },
    {
      name: 'memoized object styles are checked',
      code:
        emotion +
        'import {useMemo} from "react"; const style = useMemo(() => ({".slot button": {color: "red"}}), []); const C = <div css={style} />;',
      filename,
      errors,
    },
    {
      name: 'typed shared style helpers are checked at their definition',
      code: "import type {StrictCSSObject as Styles} from '@sentry/scraps/theme'; export function getStyles(): Styles { return {button: {color: 'red'}}; }",
      filename,
      errors,
    },
    {
      name: 'typed CSS objects are checked',
      code: "import type {CSSObject} from '@emotion/react'; const styles: CSSObject = {'> div': {color: 'red'}};",
      filename,
      errors,
    },
    {
      name: 'satisfies can declare a shared CSS object',
      code: "import type {CSSObject} from '@emotion/react'; const styles = {'> div': {color: 'red'}} satisfies CSSObject;",
      filename,
      errors,
    },
    {
      name: 'Select styles include string, element, and computed component keys',
      code: "import {Select, CheckWrap} from '@sentry/scraps/select'; const C = <Select styles={{menu: base => ({...base, '.option > div': {height: 32}, [String(CheckWrap)]: {height: 32}})}} />;",
      filename,
      errors: [...errors, ...errors],
    },
    {
      name: 'file exclusions belong to configuration',
      code: emotion + 'const C = css`button {color:red;}`;',
      filename: 'static/packages/scraps/src/button.tsx',
      errors,
    },
  ],
});
