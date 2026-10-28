import {RuleTester} from 'oxlint/plugins-dev';

import {requireFieldComponent} from './requireFieldComponent';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {lang: 'tsx'},
  },
});

const errors = [{messageId: 'missingComponent'}];

ruleTester.run('require-field-component', requireFieldComponent, {
  valid: [
    {
      name: 'allows array-mode AppFields without a bound component',
      code: '<form.AppField name="pathMappings" mode="array">{field => <CustomList values={field.state.value} />}</form.AppField>',
    },
    {
      name: 'allows array mode passed as an expression on a field group',
      code: '<group.AppField name="items" mode={"array"}>{field => <CustomList onAdd={() => field.pushValue({name: ""})} />}</group.AppField>',
    },
    {
      name: 'allows array-mode children attributes without a field parameter',
      code: '<form.AppField name="items" mode="array" children={() => <CustomList />} />',
    },
    {
      name: 'uses Field for collection management and AppField for item inputs',
      code: '<form.Field name="items" mode="array">{arrayField => <><form.AppField name="items[0].name">{field => <field.Input />}</form.AppField><button onClick={() => arrayField.pushValue({name: ""})}>Add item</button></>}</form.Field>',
    },
    {
      name: 'renders a bound input',
      code: '<group.AppField name="sourceRoot">{field => <field.Input value={field.state.value} onChange={field.handleChange} />}</group.AppField>',
    },
    {
      name: 'uses Base for a custom control',
      code: '<form.AppField name="name">{field => <field.Base><CustomInput /></field.Base>}</form.AppField>',
    },
    {
      name: 'does not depend on the callback parameter name',
      code: '<form.AppField name="name">{nameField => <nameField.Select />}</form.AppField>',
    },
    {
      name: 'accepts a bound control with layout and meta components',
      code: '<form.AppField name="name">{field => <field.Layout.Row><field.Input /><field.Meta /></field.Layout.Row>}</form.AppField>',
    },
    {
      name: 'accepts other field components',
      code: '<form.AppField name="name">{field => <field.CustomControl />}</form.AppField>',
    },
    {
      name: 'finds a field component inside wrappers and fragments',
      code: '<form.AppField name="name">{field => <Wrapper><><field.Input /></></Wrapper>}</form.AppField>',
    },
    {
      name: 'supports conditional rendering',
      code: '<form.AppField name="name">{field => condition ? <field.Input /> : null}</form.AppField>',
    },
    {
      name: 'supports logical expressions',
      code: '<form.AppField name="name">{field => condition && <field.Input />}</form.AppField>',
    },
    {
      name: 'supports block callbacks and early null returns',
      code: '<form.AppField name="name">{field => { if (hidden) return null; return <field.Input />; }}</form.AppField>',
    },
    {
      name: 'supports function expressions',
      code: '<form.AppField name="name">{function(field) { return <field.Input />; }}</form.AppField>',
    },
    {
      name: 'supports children attributes',
      code: '<form.AppField name="name" children={field => <field.Input />} />',
    },
    {
      name: 'supports parenthesized callbacks',
      code: '<form.AppField name="name">{((field => <field.Input />))}</form.AppField>',
    },
    {
      name: 'supports typed callback parameters',
      code: '<form.AppField name="name">{(field: FieldApi) => <field.Input />}</form.AppField>',
    },
    {
      name: 'supports destructured field components and aliases',
      code: '<form.AppField name="name">{({Input: NameInput}) => <NameInput />}</form.AppField>',
    },
    {
      name: 'supports destructured Base with layout and meta components',
      code: '<form.AppField name="name">{({Base, Layout, Meta}) => <Layout.Row><Base><CustomInput /></Base><Meta /></Layout.Row>}</form.AppField>',
    },
    {
      name: 'supports other destructured field components and aliases',
      code: '<form.AppField name="name">{({CustomControl: Input}) => <Input />}</form.AppField>',
    },
    {
      name: 'supports default parameters',
      code: '<form.AppField name="name">{(field = fallback) => <field.Input />}</form.AppField>',
    },
    {
      name: 'supports rest properties',
      code: '<form.AppField name="name">{({state, ...field}) => <field.Input />}</form.AppField>',
    },
    {
      name: 'supports nested fields with the same parameter name',
      code: '<form.AppField name="outer">{field => <field.Base><form.AppField name="inner">{field => <field.Input />}</form.AppField></field.Base>}</form.AppField>',
    },
    {
      name: 'supports AutoSaveForm',
      code: 'import {AutoSaveForm} from "@sentry/scraps/form"; <AutoSaveForm>{field => <field.Input />}</AutoSaveForm>',
    },
    {
      name: 'supports aliased and namespace AutoSaveForm imports',
      code: 'import {AutoSaveForm as SaveField} from "@sentry/scraps/form"; import * as Forms from "@sentry/scraps/form"; const fields = [<SaveField>{field => <field.Base><CustomInput /></field.Base>}</SaveField>, <Forms.AutoSaveForm>{field => <field.Input />}</Forms.AutoSaveForm>];',
    },
    {
      name: 'ignores other form components',
      code: '<form.AppForm>{form => <CustomForm />}</form.AppForm>',
    },
    {
      name: 'ignores unrelated AutoSaveForm imports',
      code: 'import {AutoSaveForm} from "other-library"; <AutoSaveForm>{field => <CustomInput />}</AutoSaveForm>',
    },
    {
      name: 'ignores shadowed AutoSaveForm imports',
      code: 'import {AutoSaveForm} from "@sentry/scraps/form"; function render(AutoSaveForm) { return <AutoSaveForm>{field => <CustomInput />}</AutoSaveForm>; }',
    },
    {
      name: 'ignores callbacks that are not inline',
      code: '<form.AppField name="name">{renderField}</form.AppField>',
    },
  ],
  invalid: [
    {
      name: 'rejects layout and meta without a bound control',
      code: '<form.AppField name="name">{field => <field.Layout.Row><CustomInput /><field.Meta /></field.Layout.Row>}</form.AppField>',
      errors,
    },
    ...['Layout', 'Meta'].flatMap(component => [
      {
        name: `rejects ${component} alone`,
        code: `<form.AppField name="name">{field => <field.${component} />}</form.AppField>`,
        errors,
      },
      {
        name: `rejects destructured ${component}`,
        code: `<form.AppField name="name">{({${component}}) => <${component} />}</form.AppField>`,
        errors,
      },
      {
        name: `rejects aliased ${component}`,
        code: `<form.AppField name="name">{({${component}: Input}) => <Input />}</form.AppField>`,
        errors,
      },
      {
        name: `rejects ${component} on a rest binding`,
        code: `<form.AppField name="name">{({state, ...field}) => <field.${component} />}</form.AppField>`,
        errors,
      },
      {
        name: `rejects ${component} alone in AutoSaveForm`,
        code: `import {AutoSaveForm} from "@sentry/scraps/form"; <AutoSaveForm>{field => <field.${component} />}</AutoSaveForm>`,
        errors,
      },
    ]),
    {
      name: 'rejects a layout namespace member',
      code: '<form.AppField name="name">{field => <field.Layout.Row />}</form.AppField>',
      errors,
    },
    {
      name: 'rejects a destructured layout namespace member',
      code: '<form.AppField name="name">{({Layout}) => <Layout.Row />}</form.AppField>',
      errors,
    },
    {
      name: 'rejects nested layout destructuring',
      code: '<form.AppField name="name">{({Layout: {Row: Input}}) => <Input />}</form.AppField>',
      errors,
    },
    {
      name: 'checks item fields inside an exempt array-mode AppField',
      code: '<form.AppField name="items" mode="array">{arrayField => arrayField.state.value.map((_, index) => <form.AppField key={index} name={`items[${index}].name`}>{field => <CustomInput value={field.state.value} />}</form.AppField>)}</form.AppField>',
      errors,
    },
    {
      name: 'does not exempt value-mode AppFields',
      code: '<form.AppField name="name" mode="value">{field => <CustomInput value={field.state.value} />}</form.AppField>',
      errors,
    },
    {
      name: 'does not exempt unknown modes',
      code: '<form.AppField name="name" mode={mode}>{field => <CustomInput value={field.state.value} />}</form.AppField>',
      errors,
    },
    {
      name: 'does not exempt AutoSaveForm based on its mode prop',
      code: 'import {AutoSaveForm} from "@sentry/scraps/form"; <AutoSaveForm mode="array">{field => <CustomInput value={field.state.value} />}</AutoSaveForm>',
      errors,
    },
    {
      name: 'checks item inputs inside a collection Field',
      code: '<form.Field name="items" mode="array">{arrayField => arrayField.state.value.map((_, index) => <form.AppField key={index} name={`items[${index}].name`}>{field => <CustomInput value={field.state.value} />}</form.AppField>)}</form.Field>',
      errors,
    },
    {
      name: 'rejects custom controls without Base',
      code: '<group.AppField name="sourceRoot">{field => <CustomInput value={field.state.value} onChange={field.handleChange} />}</group.AppField>',
      errors,
    },
    {
      name: 'requires a field callback parameter',
      code: '<form.AppField name="name">{() => <CustomInput />}</form.AppField>',
      errors,
    },
    {
      name: 'rejects callbacks with no field component',
      code: '<form.AppField name="name">{field => <CustomInput />}</form.AppField>',
      errors,
    },
    {
      name: 'rejects state-only rendering',
      code: '<form.AppField name="name">{field => <span>{field.state.value}</span>}</form.AppField>',
      errors,
    },
    {
      name: 'rejects destructured state and handlers',
      code: '<form.AppField name="name">{({state, handleChange}) => <CustomInput value={state.value} onChange={handleChange} />}</form.AppField>',
      errors,
    },
    {
      name: 'does not mistake a destructured state property for a field component',
      code: '<form.AppField name="name">{({state: {value: Input}}) => <Input />}</form.AppField>',
      errors,
    },
    {
      name: 'does not count passing a component as a prop',
      code: '<form.AppField name="name">{field => <CustomInput component={field.Input} />}</form.AppField>',
      errors,
    },
    {
      name: 'does not count a component on another object',
      code: '<form.AppField name="name">{field => <otherField.Input />}</form.AppField>',
      errors,
    },
    {
      name: 'does not count members of field state',
      code: '<form.AppField name="name">{field => <field.state.Input />}</form.AppField>',
      errors,
    },
    {
      name: 'does not count shadowed parameter bindings',
      code: '<form.AppField name="name">{field => <Wrapper>{items.map(field => <field.Input />)}</Wrapper>}</form.AppField>',
      errors,
    },
    {
      name: 'does not count components from a nested field for the outer field',
      code: '<form.AppField name="outer">{field => <form.AppField name="inner">{field => <field.Input />}</form.AppField>}</form.AppField>',
      errors,
    },
    {
      name: 'reports each field independently',
      code: '<form.AppField name="outer">{field => <form.AppField name="inner">{field => <CustomInput />}</form.AppField>}</form.AppField>',
      errors: [...errors, ...errors],
    },
    {
      name: 'checks block callbacks',
      code: '<form.AppField name="name">{field => { return <CustomInput onChange={field.handleChange} />; }}</form.AppField>',
      errors,
    },
    {
      name: 'checks children attributes',
      code: '<form.AppField name="name" children={field => <CustomInput />} />',
      errors,
    },
    {
      name: 'checks callbacks returning null',
      code: '<form.AppField name="name">{field => null}</form.AppField>',
      errors,
    },
    {
      name: 'checks AutoSaveForm custom controls',
      code: 'import {AutoSaveForm} from "@sentry/scraps/form"; <AutoSaveForm>{field => <CustomInput value={field.state.value} />}</AutoSaveForm>',
      errors,
    },
    {
      name: 'checks aliased AutoSaveForm imports',
      code: 'import {AutoSaveForm as SaveField} from "@sentry/scraps/form"; <SaveField>{field => <CustomInput />}</SaveField>',
      errors,
    },
    {
      name: 'checks namespace AutoSaveForm imports',
      code: 'import * as Forms from "@sentry/scraps/form"; <Forms.AutoSaveForm>{field => <CustomInput />}</Forms.AutoSaveForm>',
      errors,
    },
  ],
});
