import {Fragment} from 'react';
import documentation from '!!type-loader!sentry/components/core/select';

import {Select} from 'sentry/components/core/select';
import {IconGraphBar} from 'sentry/icons/iconGraphBar';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Select', (story, APIReference) => {
  APIReference(documentation.props?.Select);

  story('Sizes', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Select" /> component comes in different sizes:
        </p>
        <Storybook.Grid>
          <Select
            size="md"
            placeholder="medium"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
          <Select
            size="sm"
            placeholder="small"
            defaultValue={{value: 'item1', label: 'Item 1'}}
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
          <Select
            size="xs"
            placeholder="x-small"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
        </Storybook.Grid>
      </Fragment>
    );
  });

  story('Disabled', () => {
    return (
      <Fragment>
        <Storybook.Grid>
          <Select
            isDisabled
            size="md"
            placeholder="medium"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
          <Select
            isDisabled
            size="sm"
            placeholder="small"
            defaultValue={{value: 'item1', label: 'Item 1'}}
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
          <Select
            isDisabled
            size="xs"
            placeholder="x-small"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
            ]}
          />
        </Storybook.Grid>
      </Fragment>
    );
  });

  story('With inFieldLabel', () => {
    return (
      <Storybook.Grid>
        <Select
          inFieldLabel="Hello world"
          size="md"
          placeholder="medium"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
        <Select
          size="sm"
          placeholder="small"
          inFieldLabel="Hello world"
          defaultValue={{value: 'item1', label: 'Item 1'}}
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
        <Select
          size="xs"
          placeholder="x-small"
          inFieldLabel="Hello world"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
      </Storybook.Grid>
    );
  });

  story('Clearable', () => {
    return (
      <Storybook.Grid>
        <Select
          isClearable
          defaultValue={{value: 'item1', label: 'Item 1'}}
          size="md"
          placeholder="medium"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
        <Select
          isClearable
          size="sm"
          placeholder="small"
          defaultValue={{value: 'item1', label: 'Item 1'}}
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
        <Select
          isClearable
          defaultValue={{value: 'item1', label: 'Item 1'}}
          size="xs"
          placeholder="x-small"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
      </Storybook.Grid>
    );
  });

  story('Searchable', () => {
    return (
      <Storybook.Grid>
        <Select
          isSearchable
          size="md"
          placeholder="medium"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
        <Select
          isSearchable
          size="sm"
          placeholder="small"
          defaultValue={{value: 'item1', label: 'Item 1'}}
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
        <Select
          isSearchable
          size="xs"
          placeholder="x-small"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
        />
      </Storybook.Grid>
    );
  });

  story('With leading items', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Select" /> component options can use the{' '}
          <Storybook.JSXNode name="leadingItems" /> prop to add an icon to the left of the
          option.
        </p>
        <Storybook.Grid>
          <Select
            isSearchable
            size="md"
            placeholder="medium"
            defaultValue={{
              value: 'item1',
              label: 'Item 1',
              leadingItems: <IconGraphBar />,
            }}
            options={[
              {value: 'item1', label: 'Item 1', leadingItems: <IconGraphBar />},
              {value: 'item2', label: 'Item 2', leadingItems: <IconGraphBar />},
            ]}
          />
          <Select
            isSearchable
            size="sm"
            placeholder="small"
            defaultValue={{
              value: 'item1',
              label: 'Item 1',
              leadingItems: <IconGraphBar />,
            }}
            options={[
              {value: 'item1', label: 'Item 1', leadingItems: <IconGraphBar />},
              {value: 'item2', label: 'Item 2', leadingItems: <IconGraphBar />},
            ]}
          />
          <Select
            isSearchable
            size="xs"
            placeholder="x-small"
            defaultValue={{
              value: 'item1',
              label: 'Item 1',
              leadingItems: <IconGraphBar />,
            }}
            options={[
              {value: 'item1', label: 'Item 1', leadingItems: <IconGraphBar />},
              {value: 'item2', label: 'Item 2', leadingItems: <IconGraphBar />},
            ]}
          />
        </Storybook.Grid>
      </Fragment>
    );
  });
});
