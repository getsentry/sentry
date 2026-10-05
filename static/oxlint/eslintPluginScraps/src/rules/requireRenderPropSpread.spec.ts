import {RuleTester} from 'oxlint/plugins-dev';

import {requireRenderPropSpread} from './requireRenderPropSpread';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

const IMPORTS = `
import {Container, Flex, Grid, Stack, Surface} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
`;

function error(component: string) {
  return {messageId: 'noDestructure', data: {component}};
}

ruleTester.run('require-render-prop-spread', requireRenderPropSpread, {
  valid: [
    {
      name: 'spreads props onto the rendered element',
      code: `${IMPORTS}
        const element = (
          <Container width={{zero: '100%', md: 'max-content'}}>
            {containerProps => (
              <EnvironmentPageFilter {...containerProps} triggerProps={{style: {width: '100%'}}} />
            )}
          </Container>
        );
      `,
    },
    {
      name: 'does not inspect how a props parameter is used',
      code: `${IMPORTS}
        const element = <Container>{props => <CustomElement className={props.className} />}</Container>;
      `,
    },
    {
      name: 'allows spreading props inside another prop',
      code: `${IMPORTS}
        const element = (
          <Container>
            {triggerProps => (
              <DropdownMenu triggerProps={{...triggerProps, size: 'md'}} />
            )}
          </Container>
        );
      `,
    },
    {
      name: 'supports render functions on scraps components',
      code: `${IMPORTS}
        const elements = [
          <Container>{props => <CustomElement {...props} />}</Container>,
          <Flex>{props => <CustomElement {...props} />}</Flex>,
          <Grid>{props => <CustomElement {...props} />}</Grid>,
          <Stack>{props => <CustomElement {...props} />}</Stack>,
          <Surface>{props => <CustomElement {...props} />}</Surface>,
          <Text>{props => <CustomElement {...props} />}</Text>,
          <Heading>{props => <CustomElement {...props} />}</Heading>,
        ];
      `,
    },
    {
      name: 'allows additional props after the spread',
      code: `${IMPORTS}
        const element = <Text>{props => <CustomElement {...props} data-test-id="text" />}</Text>;
      `,
    },
    {
      name: 'allows mergeProps to combine all callback props',
      code: `${IMPORTS}
        const element = <Stack>{props => <CustomElement {...mergeProps(props, otherProps)} />}</Stack>;
      `,
    },
    {
      name: 'allows forwarding props to a nested rendered element',
      code: `${IMPORTS}
        const element = <Flex>{props => <Wrapper><CustomElement {...props} /></Wrapper>}</Flex>;
      `,
    },
    {
      name: 'checks all roots in a fragment',
      code: `${IMPORTS}
        const element = (
          <Grid>
            {props => (
              <>
                <FirstElement {...props} />
                {condition && <SecondElement {...props} />}
              </>
            )}
          </Grid>
        );
      `,
    },
    {
      name: 'checks block-body callbacks',
      code: `${IMPORTS}
        const element = (
          <Flex>
            {props => {
              if (condition) {
                return <FirstElement {...props} />;
              }
              return <SecondElement {...props} />;
            }}
          </Flex>
        );
      `,
    },
    {
      name: 'supports children passed as an attribute',
      code: `${IMPORTS}
        const element = <Container children={props => <CustomElement {...props} />} />;
      `,
    },
    {
      name: 'supports aliased and namespace imports',
      code: `
        import {Text as Label} from '@sentry/scraps/text';
        import * as Layout from '@sentry/scraps/layout';
        const elements = [
          <Label>{props => <CustomElement {...props} />}</Label>,
          <Layout.Grid>{props => <CustomElement {...props} />}</Layout.Grid>,
        ];
      `,
    },
    {
      name: 'supports scraps subpath imports',
      code: `
        import {Container} from '@sentry/scraps/layout/container';
        import {Text} from '@sentry/scraps/text/text';
        const elements = [
          <Container>{props => <CustomElement {...props} />}</Container>,
          <Text>{props => <CustomElement {...props} />}</Text>,
        ];
      `,
    },
    {
      name: 'supports arbitrary named scraps imports',
      code: `
        import {SomeComponent} from '@sentry/scraps/some-component';
        const element = <SomeComponent>{props => <CustomElement {...props} />}</SomeComponent>;
      `,
    },
    {
      name: 'supports imports from the scraps package root',
      code: `
        import {SomeComponent} from '@sentry/scraps';
        const element = <SomeComponent>{props => <CustomElement {...props} />}</SomeComponent>;
      `,
    },
    {
      name: 'ignores form render props',
      code: `
        import {AutoSaveForm} from '@sentry/scraps/form';
        const element = (
          <AutoSaveForm>
            {field => (
              <field.Layout.Row label="Name">
                <field.Input value={field.state.value} onChange={field.handleChange} />
                <field.Meta />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        );
      `,
    },
    {
      name: 'ignores slide over panel state render props',
      code: `
        import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
        const element = (
          <SlideOverPanel>
            {({isOpening}) => {
              if (isOpening) {
                return <Skeleton />;
              }
              return (
                <>
                  <Header />
                  {condition && <Content />}
                </>
              );
            }}
          </SlideOverPanel>
        );
      `,
    },
    {
      name: 'ignores non-scraps components',
      code: `
        import {Text} from 'somewhere-else';
        const element = <Text>{({className}) => <CustomElement className={className} />}</Text>;
      `,
    },
    {
      name: 'ignores non-function children and callbacks without JSX output',
      code: `${IMPORTS}
        const elements = [
          <Text>text</Text>,
          <Grid>{() => null}</Grid>,
        ];
      `,
    },
  ],
  invalid: [
    {
      name: 'rejects destructuring render props',
      code: `${IMPORTS}
        const element = (
          <Text bold size="sm" uppercase variant="muted">
            {({className}) => <Grid className={className} />}
          </Text>
        );
      `,
      errors: [error('Text')],
    },
    {
      name: 'requires a callback parameter when JSX is returned',
      code: `${IMPORTS}
        const element = <Heading>{() => <CustomElement />}</Heading>;
      `,
      errors: [error('Heading')],
    },
    {
      name: 'rejects destructuring for arbitrary scraps imports',
      code: `
        import {SomeComponent as RenderPropComponent} from '@sentry/scraps/some-component';
        const element = (
          <RenderPropComponent>
            {({className}) => <CustomElement className={className} />}
          </RenderPropComponent>
        );
      `,
      errors: [error('SomeComponent')],
    },
    {
      name: 'rejects destructuring for arbitrary scraps namespace imports',
      code: `
        import * as Scraps from '@sentry/scraps/some-component';
        const element = (
          <Scraps.SomeComponent>
            {({className}) => <CustomElement className={className} />}
          </Scraps.SomeComponent>
        );
      `,
      errors: [error('SomeComponent')],
    },
    {
      name: 'rejects destructuring for default scraps imports',
      code: `
        import SomeComponent from '@sentry/scraps/some-component';
        const element = (
          <SomeComponent>
            {({className}) => <CustomElement className={className} />}
          </SomeComponent>
        );
      `,
      errors: [error('SomeComponent')],
    },
  ],
});
