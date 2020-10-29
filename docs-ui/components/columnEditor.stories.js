import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import GlobalModal from 'app/components/globalModal';
import ColumnEditModal, {modalCss} from 'app/views/eventsV2/table/columnEditModal';

export default {
  title: 'Features/Discover/ColumnEditor',
};

export const All = withInfo({
  text: 'Playground for building out column editor v2 for discover',
})(() => {
  const organization = {
    slug: 'test-org',
    features: ['discover-query', 'performance-view'],
  };
  const tags = ['browser.name', 'custom-field', 'project'];
  const columns = [
    {
      kind: 'field',
      field: 'event.type',
    },
    {
      kind: 'field',
      field: 'browser.name',
    },
    {
      kind: 'function',
      function: ['count', 'id'],
    },
    {
      kind: 'function',
      function: ['count_unique', 'title'],
    },
    {
      kind: 'function',
      function: ['p95'],
    },
    {
      kind: 'field',
      field: 'issue.id',
    },
    {
      kind: 'function',
      function: ['count_unique', 'issue.id'],
    },
    {
      kind: 'function',
      function: ['percentile', 'transaction.duration', '0.81'],
    },
    {
      kind: 'field',
      field: 'tags[project]',
    },
  ];

  const showModal = () => {
    openModal(
      modalProps => (
        <ColumnEditModal
          {...modalProps}
          organization={organization}
          tagKeys={tags}
          columns={columns}
          onApply={action('onApply')}
        />
      ),
      {modalCss}
    );
  };

  return (
    <div>
      <Button onClick={showModal}>Edit columns</Button>
      <GlobalModal />
    </div>
  );
});

All.story = {
  name: 'all',
};
