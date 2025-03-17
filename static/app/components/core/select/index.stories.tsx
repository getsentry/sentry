import {Fragment} from 'react';

import {Select} from 'sentry/components/core/select';
import JSXNode from 'sentry/components/stories/jsxNode';
import {Grid} from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/select';

export default storyBook('Select', (story, APIReference) => {
  APIReference(types.Select);

  story('Sizes', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="Select" /> component comes in different sizes:
        </p>
        <Grid columns={3}>
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
        </Grid>
      </Fragment>
    );
  });

  story('Disabled', () => {
    return (
      <Fragment>
        <Grid columns={3}>
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
        </Grid>
      </Fragment>
    );
  });

  story('With inFieldLabel', () => {
    return (
      <Grid columns={3}>
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
      </Grid>
    );
  });

  story('Clearable', () => {
    return (
      <Grid columns={3}>
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
      </Grid>
    );
  });

  story('Searchable', () => {
    return (
      <Grid columns={3}>
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
      </Grid>
    );
  });
});
