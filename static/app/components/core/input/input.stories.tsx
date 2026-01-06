import {Fragment, useState} from 'react';
import documentation from '!!type-loader!sentry/components/core/input';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Input} from 'sentry/components/core/input';
import {useAutosizeInput} from 'sentry/components/core/input/useAutosizeInput';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

export default Storybook.story('Input', (story, APIReference) => {
  APIReference(documentation.props?.Input);

  story('Sizes', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Input" /> component comes in different sizes:
        </p>
        <Grid>
          <Stack as="label" gap="md">
            <Storybook.JSXProperty name="size" value="md" />
            <Input size="md" defaultValue="" />
          </Stack>
          <Stack as="label" gap="md">
            <Storybook.JSXProperty name="size" value="sm" />
            <Input size="sm" defaultValue="value" />
          </Stack>
          <Stack as="label" gap="md">
            <Storybook.JSXProperty name="size" value="xs" />
            <Input size="xs" defaultValue="" placeholder="placeholder" />
          </Stack>
        </Grid>
      </Fragment>
    );
  });

  story('Locked', () => {
    const [value, setValue] = useState('this is aria-disabled');
    const [readonlyValue, setReadonlyValue] = useState('this is readonly');
    const [disabledValue, setDisabledValue] = useState('this is disabled');
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="Input" /> can either be <code>disabled</code> or{' '}
          <code>readonly</code> to make them non-editable. <code>aria-disabled</code>{' '}
          fields are styled like a <code>disabled</code> field, but they remain
          interactive like a <code>readonly</code> field:
        </p>
        <Grid>
          <Stack as="label" gap="md">
            <Storybook.JSXProperty name="disabled" value="true" />
            <Input
              disabled
              value={disabledValue}
              onChange={e => setDisabledValue(e.target.value)}
            />
          </Stack>
          <Stack as="label" gap="md">
            <Storybook.JSXProperty name="aria-disabled" value="true" />
            <Input
              aria-disabled
              value={value}
              onChange={e => {
                setValue(e.target.value);
              }}
            />
          </Stack>
          <Stack as="label" gap="md">
            <Storybook.JSXProperty name="readOnly" value="true" />
            <Input
              readOnly
              value={readonlyValue}
              onChange={e => setReadonlyValue(e.target.value)}
            />
          </Stack>
        </Grid>
      </Fragment>
    );
  });

  story('Autosize', () => {
    const [value, setValue] = useState('this is autosized');
    const [proxyValue, setProxyValue] = useState('this is autosized');

    const controlledAutosizeRef = useAutosizeInput({
      value,
    });

    const uncontrolledAutosizeRef = useAutosizeInput({
      value: proxyValue,
    });

    const externalControlledAutosizeRef = useAutosizeInput({
      value: proxyValue,
    });

    const placeholderAutosizeRef = useAutosizeInput();

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Input" /> component can automatically resize its
          width to fit its content when used with the <code>useAutosizeInput</code> hook.
          This hook provides a ref that should be passed to the input component. The input
          will expand horizontally while maintaining its height as the user types. See the
          examples below for how to use the hook with controlled and uncontrolled inputs.
        </p>

        <p>
          If a placeholder if provided without a value, the input will autosize according
          to the placeholder size!
        </p>
        <Grid>
          <Stack as="label" gap="md">
            <code>controlled input autosize:</code>{' '}
            <Input
              ref={controlledAutosizeRef}
              value={value}
              onChange={e => setValue(e.target.value)}
            />
          </Stack>
          <Stack as="label" gap="md">
            <code>uncontrolled input autosize:</code>{' '}
            <Input ref={uncontrolledAutosizeRef} defaultValue="" />
          </Stack>

          <Stack as="label" gap="md">
            <code>controlled via different input:</code>{' '}
            <Input value={proxyValue} onChange={e => setProxyValue(e.target.value)} />
            <Input ref={externalControlledAutosizeRef} readOnly value={proxyValue} />
          </Stack>

          <Stack as="label" gap="md">
            <code>autosize according to placeholder:</code>{' '}
            <Input
              ref={placeholderAutosizeRef}
              defaultValue=""
              placeholder="placeholder"
            />
          </Stack>
        </Grid>
      </Fragment>
    );
  });
});

const Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: ${space(2)};
`;
