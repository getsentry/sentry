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
      name: 'allows ArrayFields without a bound component',
      code: '<form.ArrayField name="pathMappings">{field => <CustomList values={field.value} />}</form.ArrayField>',
    },
    {
      name: 'allows array mode passed as an expression on a field group',
      code: '<group.ArrayField name="items">{field => <CustomList onAdd={() => field.pushValue({name: ""})} />}</group.ArrayField>',
    },
    {
      name: 'allows array-mode children attributes without a field parameter',
      code: '<form.ArrayField name="items" children={() => <CustomList />} />',
    },
    {
      name: 'uses ArrayField for collection management and Field for item inputs',
      code: '<form.ArrayField name="items">{arrayField => <><form.Field name="items[0].name">{field => <field.Input />}</form.Field><button onClick={() => arrayField.pushValue({name: ""})}>Add item</button></>}</form.ArrayField>',
    },
    {
      name: 'renders a bound input',
      code: '<group.Field name="sourceRoot">{field => <field.Input value={field.value} onChange={field.handleChange} />}</group.Field>',
    },
    {
      name: 'uses Base for a custom control',
      code: '<form.Field name="name">{field => <field.Base><CustomInput /></field.Base>}</form.Field>',
    },
    {
      name: 'does not depend on the callback parameter name',
      code: '<form.Field name="name">{nameField => <nameField.Select />}</form.Field>',
    },
    {
      name: 'accepts a bound control with layout and meta components',
      code: '<form.Field name="name">{field => <field.Layout.Row><field.Input /><field.Meta /></field.Layout.Row>}</form.Field>',
    },
    {
      name: 'accepts other field components',
      code: '<form.Field name="name">{field => <field.CustomControl />}</form.Field>',
    },
    {
      name: 'finds a field component inside wrappers and fragments',
      code: '<form.Field name="name">{field => <Wrapper><><field.Input /></></Wrapper>}</form.Field>',
    },
    {
      name: 'supports conditional rendering',
      code: '<form.Field name="name">{field => condition ? <field.Input /> : null}</form.Field>',
    },
    {
      name: 'supports logical expressions',
      code: '<form.Field name="name">{field => condition && <field.Input />}</form.Field>',
    },
    {
      name: 'supports block callbacks and early null returns',
      code: '<form.Field name="name">{field => { if (hidden) return null; return <field.Input />; }}</form.Field>',
    },
    {
      name: 'supports function expressions',
      code: '<form.Field name="name">{function(field) { return <field.Input />; }}</form.Field>',
    },
    {
      name: 'supports children attributes',
      code: '<form.Field name="name" children={field => <field.Input />} />',
    },
    {
      name: 'supports parenthesized callbacks',
      code: '<form.Field name="name">{((field => <field.Input />))}</form.Field>',
    },
    {
      name: 'supports typed callback parameters',
      code: '<form.Field name="name">{(field: FieldApi) => <field.Input />}</form.Field>',
    },
    {
      name: 'supports destructured field components and aliases',
      code: '<form.Field name="name">{({Input: NameInput}) => <NameInput />}</form.Field>',
    },
    {
      name: 'supports destructured Base with layout and meta components',
      code: '<form.Field name="name">{({Base, Layout, Meta}) => <Layout.Row><Base><CustomInput /></Base><Meta /></Layout.Row>}</form.Field>',
    },
    {
      name: 'supports other destructured field components and aliases',
      code: '<form.Field name="name">{({CustomControl: Input}) => <Input />}</form.Field>',
    },
    {
      name: 'supports default parameters',
      code: '<form.Field name="name">{(field = fallback) => <field.Input />}</form.Field>',
    },
    {
      name: 'supports rest properties',
      code: '<form.Field name="name">{({state, ...field}) => <field.Input />}</form.Field>',
    },
    {
      name: 'supports nested fields with the same parameter name',
      code: '<form.Field name="outer">{field => <field.Base><form.Field name="inner">{field => <field.Input />}</form.Field></field.Base>}</form.Field>',
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
      code: '<form.Field name="name">{renderField}</form.Field>',
    },
  ],
  invalid: [
    {
      name: 'rejects layout and meta without a bound control',
      code: '<form.Field name="name">{field => <field.Layout.Row><CustomInput /><field.Meta /></field.Layout.Row>}</form.Field>',
      errors,
    },
    ...['Layout', 'Meta'].flatMap(component => [
      {
        name: `rejects ${component} alone`,
        code: `<form.Field name="name">{field => <field.${component} />}</form.Field>`,
        errors,
      },
      {
        name: `rejects destructured ${component}`,
        code: `<form.Field name="name">{({${component}}) => <${component} />}</form.Field>`,
        errors,
      },
      {
        name: `rejects aliased ${component}`,
        code: `<form.Field name="name">{({${component}: Input}) => <Input />}</form.Field>`,
        errors,
      },
      {
        name: `rejects ${component} on a rest binding`,
        code: `<form.Field name="name">{({state, ...field}) => <field.${component} />}</form.Field>`,
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
      code: '<form.Field name="name">{field => <field.Layout.Row />}</form.Field>',
      errors,
    },
    {
      name: 'rejects a destructured layout namespace member',
      code: '<form.Field name="name">{({Layout}) => <Layout.Row />}</form.Field>',
      errors,
    },
    {
      name: 'rejects nested layout destructuring',
      code: '<form.Field name="name">{({Layout: {Row: Input}}) => <Input />}</form.Field>',
      errors,
    },
    {
      name: 'checks item fields inside an exempt array-mode AppField',
      code: '<form.ArrayField name="items">{arrayField => arrayField.value.map((_, index) => <form.Field key={index} name={`items[${index}].name`}>{field => <CustomInput value={field.value} />}</form.Field>)}</form.ArrayField>',
      errors,
    },
    {
      name: 'does not exempt value-mode Fields',
      code: '<form.Field name="name" mode="value">{field => <CustomInput value={field.value} />}</form.Field>',
      errors,
    },
    {
      name: 'does not exempt unknown modes',
      code: '<form.Field name="name" mode={mode}>{field => <CustomInput value={field.value} />}</form.Field>',
      errors,
    },
    {
      name: 'does not exempt AutoSaveForm based on its mode prop',
      code: 'import {AutoSaveForm} from "@sentry/scraps/form"; <AutoSaveForm mode="array">{field => <CustomInput value={field.value} />}</AutoSaveForm>',
      errors,
    },
    {
      name: 'rejects custom controls without Base',
      code: '<group.Field name="sourceRoot">{field => <CustomInput value={field.value} onChange={field.handleChange} />}</group.Field>',
      errors,
    },
    {
      name: 'requires a field callback parameter',
      code: '<form.Field name="name">{() => <CustomInput />}</form.Field>',
      errors,
    },
    {
      name: 'rejects callbacks with no field component',
      code: '<form.Field name="name">{field => <CustomInput />}</form.Field>',
      errors,
    },
    {
      name: 'rejects state-only rendering',
      code: '<form.Field name="name">{field => <span>{field.value}</span>}</form.Field>',
      errors,
    },
    {
      name: 'rejects destructured state and handlers',
      code: '<form.Field name="name">{({state, handleChange}) => <CustomInput value={state.value} onChange={handleChange} />}</form.Field>',
      errors,
    },
    {
      name: 'does not mistake a destructured state property for a field component',
      code: '<form.Field name="name">{({state: {value: Input}}) => <Input />}</form.Field>',
      errors,
    },
    {
      name: 'does not count passing a component as a prop',
      code: '<form.Field name="name">{field => <CustomInput component={field.Input} />}</form.Field>',
      errors,
    },
    {
      name: 'does not count a component on another object',
      code: '<form.Field name="name">{field => <otherField.Input />}</form.Field>',
      errors,
    },
    {
      name: 'does not count members of field state',
      code: '<form.Field name="name">{field => <field.state.Input />}</form.Field>',
      errors,
    },
    {
      name: 'does not count shadowed parameter bindings',
      code: '<form.Field name="name">{field => <Wrapper>{items.map(field => <field.Input />)}</Wrapper>}</form.Field>',
      errors,
    },
    {
      name: 'does not count components from a nested field for the outer field',
      code: '<form.Field name="outer">{field => <form.Field name="inner">{field => <field.Input />}</form.Field>}</form.Field>',
      errors,
    },
    {
      name: 'reports each field independently',
      code: '<form.Field name="outer">{field => <form.Field name="inner">{field => <CustomInput />}</form.Field>}</form.Field>',
      errors: [...errors, ...errors],
    },
    {
      name: 'checks block callbacks',
      code: '<form.Field name="name">{field => { return <CustomInput onChange={field.handleChange} />; }}</form.Field>',
      errors,
    },
    {
      name: 'checks children attributes',
      code: '<form.Field name="name" children={field => <CustomInput />} />',
      errors,
    },
    {
      name: 'checks callbacks returning null',
      code: '<form.Field name="name">{field => null}</form.Field>',
      errors,
    },
    {
      name: 'checks AutoSaveForm custom controls',
      code: 'import {AutoSaveForm} from "@sentry/scraps/form"; <AutoSaveForm>{field => <CustomInput value={field.value} />}</AutoSaveForm>',
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
