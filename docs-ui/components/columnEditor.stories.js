import React from 'react';
import PropTypes from 'prop-types';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import {openModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import GlobalModal from 'app/components/globalModal';
import ColumnEditModal from 'app/views/eventsV2/table/columnEditModal';

storiesOf('Discover|ColumnEditor', module).add(
  'all',
  withInfo({
    text: 'Playground for building out column editor v2 for discover',
  })(() => {
    const organization = {
      slug: 'test-org',
      features: ['transaction-events'],
    };
    const tags = ['browser.name', 'custom-field'];
    const columns = [
      {
        field: 'event.type',
      },
      {
        field: 'browser.name',
      },
      {
        field: 'id',
        aggregation: 'count',
      },
    ];

    const showModal = () => {
      openModal(modalProps => (
        <ColumnEditModal
          {...modalProps}
          organization={organization}
          tagKeys={tags}
          columns={columns}
          onApply={action('onApply')}
        />
      ));
    };

    return (
      <div>
        <Button onClick={showModal}>Edit columns</Button>
        <GlobalModal />
      </div>
    );
  })
);
