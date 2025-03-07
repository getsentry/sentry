import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Input} from 'sentry/components/core/input';
import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/input';

export default storyBook('Input', (story, APIReference) => {
  APIReference(types.Input);

  story('Sizes', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Input" /> component comes in different sizes:
        </p>
        <Grid>
          <Label>
            <code>md (default):</code> <Input size="md" defaultValue="" />
          </Label>
          <Label>
            <code>sm:</code> <Input size="sm" defaultValue="value" />
          </Label>
          <Label>
            <code>xs:</code> <Input size="xs" defaultValue="" placeholder="placeholder" />
          </Label>
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
          <JSXNode name="Input" /> can either be <code>disabled</code> or{' '}
          <code>readonly</code> to make them non-editable. <code>aria-disabled</code>{' '}
          fields are styled like a <code>disabled</code> field, but they remain
          interactive like a <code>readonly</code> field:
        </p>
        <Grid>
          <Label>
            <code>disabled:</code>{' '}
            <Input
              disabled
              value={disabledValue}
              onChange={e => setDisabledValue(e.target.value)}
            />
          </Label>
          <Label>
            <code>aria-disabled:</code>{' '}
            <Input
              aria-disabled
              value={value}
              onChange={e => {
                setValue(e.target.value);
              }}
            />
          </Label>
          <Label>
            <code>readonly:</code>{' '}
            <Input
              readOnly
              value={readonlyValue}
              onChange={e => setReadonlyValue(e.target.value)}
            />
          </Label>
        </Grid>
      </Fragment>
    );
  });

  story('Autosize', () => {
    const [value, setValue] = useState('this is autosized');
    const [proxyValue, setProxyValue] = useState('this is autosized');
    return (
      <Fragment>
        <p>
          The <JSXNode name="Input" /> component can automatically resize its width to fit
          its content when the <code>autosize</code> prop is enabled. This is useful for
          inputs that need to grow as the user types. The input will expand horizontally
          while maintaining its height.
        </p>

        <p>
          If a placeholder if provided without a value, the input will autosize according
          to the placeholder size!
        </p>
        <Grid>
          <Label>
            <code>controlled input autosize:</code>{' '}
            <Input autosize value={value} onChange={e => setValue(e.target.value)} />
          </Label>
          <Label>
            <code>uncontrolled input autosize:</code> <Input autosize defaultValue="" />
          </Label>

          <Label>
            <code>controlled via different input:</code>{' '}
            <Input value={proxyValue} onChange={e => setProxyValue(e.target.value)} />
            <Input autosize readOnly value={proxyValue} />
          </Label>

          <Label>
            <code>autosize according to placeholder:</code>{' '}
            <Input autosize defaultValue="" placeholder="placeholder" />
          </Label>
        </Grid>
      </Fragment>
    );
  });
});

const Label = styled('label')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const Grid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: ${space(2)};
`;
