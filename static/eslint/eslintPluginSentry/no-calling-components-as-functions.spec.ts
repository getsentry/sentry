import {RuleTester} from '@typescript-eslint/rule-tester';

import {noCallingComponentsAsFunctions} from './no-calling-components-as-functions';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('no-calling-components-as-functions', noCallingComponentsAsFunctions, {
  valid: [
    // Already JSX — component is imported but used correctly
    {code: 'import {Component} from "./c"; const x = <Component prop={value} />;'},
    // Lowercase function — not a component
    {code: 'const x = lowercase({a: 1});'},
    // Built-in constructors — not imported/declared, so ignored
    {code: 'const x = Boolean(value);'},
    {code: 'const x = String(value);'},
    {code: 'const x = Number(value);'},
    {code: 'const x = Date(value);'},
    {code: 'const x = Error("msg");'},
    // PascalCase function that is NOT imported or declared — ignored
    {code: 'const x = UnknownThing({a: 1});'},
    // Fixture suffix — even if imported, skip
    {
      code: 'import {ProjectFixture} from "sentry-fixture/project"; const x = ProjectFixture({slug: "test"});',
    },
    {
      code: 'import {OrganizationFixture} from "sentry-fixture/organization"; const x = OrganizationFixture();',
    },
    // sentry-fixture imports — data factories, not components
    {
      code: 'import {AutofixCodebaseChangeData} from "sentry-fixture/autofixCodebaseChangeData"; const x = AutofixCodebaseChangeData();',
    },
    // ECharts config builder imports — not components
    {
      code: 'import {AreaSeries} from "sentry/components/charts/series/areaSeries"; const x = AreaSeries({data: []});',
    },
    {
      code: 'import {LineSeries} from "sentry/components/charts/series/lineSeries"; const x = LineSeries({color: "red"});',
    },
    {
      code: 'import {XAxis} from "sentry/components/charts/components/xAxis"; const x = XAxis({type: "category"});',
    },
    // Relative imports from chart dirs — also skipped
    {
      code: 'import {LineSeries} from "./series/lineSeries"; const x = LineSeries({color: "red"});',
      filename: '/project/static/app/components/charts/baseChart.tsx',
    },
    {
      code: 'import {MarkLine} from "../components/markLine"; const x = MarkLine({data: []});',
      filename: '/project/static/app/components/charts/series/test.tsx',
    },
    // Known utility — even if imported, skip
    {
      code: 'import {HookOrDefault} from "sentry/utils/hook"; const x = HookOrDefault({hookName: "x"});',
    },
    // All-uppercase names — constants, not components
    {
      code: 'import {DO_NOT_USE_getButtonStyles} from "./styles"; const x = DO_NOT_USE_getButtonStyles({size: "md"});',
    },
    {
      code: 'import {DANGEROUS_SET_REACT_ROUTER_6_HISTORY} from "./router"; DANGEROUS_SET_REACT_ROUTER_6_HISTORY({history});',
    },
    {
      code: 'const BREAKPOINTS = (theme) => ({ mobile: 0 }); const x = BREAKPOINTS(theme);',
    },
    // Multiple arguments — not a component call pattern
    {
      code: 'import {Component} from "./c"; const x = Component({a: 1}, {b: 2});',
    },
    // MemberExpression callee — not a simple Identifier
    {code: 'const x = obj.Component({a: 1});'},
    // Literal argument
    {code: 'import {Component} from "./c"; const x = Component("string");'},
    // Array argument
    {code: 'import {Component} from "./c"; const x = Component([1, 2]);'},
    // Template literal argument
    {code: 'import {Component} from "./c"; const x = Component(`template`);'},
    // Declared as a non-function variable — not tracked
    {code: 'const Component = "hello"; const x = Component({a: 1});'},
  ],

  invalid: [
    // Imported component — no arguments
    {
      code: 'import {Component} from "./c"; const x = Component();',
      output: 'import {Component} from "./c"; const x = <Component />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — empty object
    {
      code: 'import {Component} from "./c"; const x = Component({});',
      output: 'import {Component} from "./c"; const x = <Component />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — shorthand properties
    {
      code: 'import {Component} from "./c"; const x = Component({prop1, prop2});',
      output:
        'import {Component} from "./c"; const x = <Component prop1={prop1} prop2={prop2} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — key-value property
    {
      code: 'import {Component} from "./c"; const x = Component({key: value});',
      output: 'import {Component} from "./c"; const x = <Component key={value} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — mixed shorthand and key-value
    {
      code: 'import {Component} from "./c"; const x = Component({prop1: value1, prop2});',
      output:
        'import {Component} from "./c"; const x = <Component prop1={value1} prop2={prop2} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — spread element
    {
      code: 'import {Component} from "./c"; const x = Component({...spread});',
      output: 'import {Component} from "./c"; const x = <Component {...spread} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — mixed props and spread
    {
      code: 'import {Component} from "./c"; const x = Component({prop, ...rest});',
      output:
        'import {Component} from "./c"; const x = <Component prop={prop} {...rest} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — identifier argument (spread into JSX)
    {
      code: 'import {Component} from "./c"; const x = Component(props);',
      output: 'import {Component} from "./c"; const x = <Component {...props} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Locally declared function component — in return statement
    {
      code: 'function ViewerTable({results, loading}) { return <div />; } function render() { return ViewerTable({results, loading}); }',
      output:
        'function ViewerTable({results, loading}) { return <div />; } function render() { return <ViewerTable results={results} loading={loading} />; }',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — inline in JSX attribute
    {
      code: 'import {OrganizationRegionAction} from "./action"; const x = <Wrapper action={OrganizationRegionAction({organization})} />;',
      output:
        'import {OrganizationRegionAction} from "./action"; const x = <Wrapper action={<OrganizationRegionAction organization={organization} />} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Imported component — computed property, no autofix
    {
      code: 'import {Component} from "./c"; const x = Component({[dynamicKey]: value});',
      output: null,
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Default import
    {
      code: 'import Component from "./c"; const x = Component({prop});',
      output: 'import Component from "./c"; const x = <Component prop={prop} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Arrow function component
    {
      code: 'const Component = () => <div />; const x = Component({prop});',
      output: 'const Component = () => <div />; const x = <Component prop={prop} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
    // Function expression component
    {
      code: 'const Component = function() { return <div />; }; const x = Component({prop});',
      output:
        'const Component = function() { return <div />; }; const x = <Component prop={prop} />;',
      errors: [{messageId: 'noCallingComponentAsFunction'}],
    },
  ],
});
