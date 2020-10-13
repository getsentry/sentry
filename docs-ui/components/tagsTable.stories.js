import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {text} from '@storybook/addon-knobs';

import TagsTable from 'app/components/tagsTable';

const event = {
  id: 'deadbeef',
  tags: [
    {value: 'prod', key: 'environment', _meta: null},
    {value: 'info', key: 'level', _meta: null},
    {value: '1449204', key: 'project', _meta: null},
    {value: '72ee409ef6df14396e6a608abbcd017aa374e497', key: 'release', _meta: null},
    {value: 'CPython 2.7.16', key: 'runtime', _meta: null},
    {value: 'CPython', key: 'runtime.name', _meta: null},
    {value: 'worker-65881005', key: 'server_name', _meta: null},
    {value: 'internal_error', key: 'status', _meta: null},
    {value: 'sentry.tasks.store.save_event', key: 'task_name', _meta: null},
    {value: '3c75bc89a4d4442b81af4cb41b6a1571', key: 'trace', _meta: null},
    {
      value: '3c75bc89a4d4442b81af4cb41b6a1571-8662ecdaef1bbbaf',
      key: 'trace.ctx',
    },
    {value: '8662ecdaef1bbbaf', key: 'trace.span', _meta: null},
    {value: 'sentry.tasks.store.save_event', key: 'transaction', _meta: null},
  ],
};

export default {
  title: 'Core/Tables/TagsTable',
};

export const Default = withInfo(
  'Display a table of tags with each value as a link, generally to another search result.'
)(() => {
  return (
    <TagsTable
      title={text('title', 'Event Tags')}
      query="event.type:error"
      event={event}
      generateUrl={tag => `/issues/search?key=${tag.key}&value=${tag.value}`}
    />
  );
});

Default.story = {
  name: 'default',
};
