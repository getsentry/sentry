import {Fragment} from 'react';

import {Select} from 'sentry/components/core/select';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Multiple Select', story => {
  story('Sizes', () => {
    return (
      <Storybook.Grid>
        <Select
          size="md"
          multiple
          placeholder="medium"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
        <Select
          size="sm"
          multiple
          placeholder="small"
          defaultValue={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item3', label: 'Item 3'},
          ]}
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
        <Select
          size="xs"
          multiple
          placeholder="x-small"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
      </Storybook.Grid>
    );
  });

  story('Disabled', () => {
    return (
      <Fragment>
        <Storybook.Grid columns={3}>
          <Select
            isDisabled
            multiple
            size="md"
            placeholder="medium"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
              {value: 'item3', label: 'Item 3'},
            ]}
          />
          <Select
            isDisabled
            multiple
            size="sm"
            placeholder="small"
            defaultValue={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item3', label: 'Item 3'},
            ]}
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
              {value: 'item3', label: 'Item 3'},
            ]}
          />
          <Select
            isDisabled
            multiple
            size="xs"
            placeholder="x-small"
            options={[
              {value: 'item1', label: 'Item 1'},
              {value: 'item2', label: 'Item 2'},
              {value: 'item3', label: 'Item 3'},
            ]}
          />
        </Storybook.Grid>
      </Fragment>
    );
  });

  story('Clearable', () => {
    return (
      <Storybook.Grid>
        <Select
          multiple
          isClearable
          defaultValue={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item3', label: 'Item 3'},
          ]}
          size="md"
          placeholder="medium"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
        <Select
          isClearable
          multiple
          size="sm"
          placeholder="small"
          defaultValue={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item3', label: 'Item 3'},
          ]}
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
        <Select
          isClearable
          multiple
          defaultValue={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item3', label: 'Item 3'},
          ]}
          size="xs"
          placeholder="x-small"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
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
          multiple
          size="md"
          placeholder="medium"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
        <Select
          isSearchable
          multiple
          size="sm"
          placeholder="small"
          defaultValue={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item3', label: 'Item 3'},
          ]}
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
        <Select
          isSearchable
          multiple
          size="xs"
          placeholder="x-small"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
            {value: 'item3', label: 'Item 3'},
          ]}
        />
      </Storybook.Grid>
    );
  });
});
