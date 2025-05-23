import {Fragment} from 'react';

import {Select} from 'sentry/components/core/select';
import {Grid} from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('Multiple Select', story => {
  story('Sizes', () => {
    return (
      <Grid columns={3}>
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
      </Grid>
    );
  });

  story('Disabled', () => {
    return (
      <Fragment>
        <Grid columns={3}>
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
        </Grid>
      </Fragment>
    );
  });

  story('Clearable', () => {
    return (
      <Grid columns={3}>
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
      </Grid>
    );
  });

  story('Searchable', () => {
    return (
      <Grid columns={3}>
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
      </Grid>
    );
  });
});
