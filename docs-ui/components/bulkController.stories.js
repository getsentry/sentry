import React from 'react';
import {withInfo} from '@storybook/addon-info';

import Checkbox from 'app/components/checkbox';
import BulkController from 'app/utils/bulkController';
import {PanelTable} from 'app/components/panels';

export default {
  title: 'UI/BulkController',
};

const dummy = [
  {
    id: 1,
    text:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 2,
    text:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 3,
    text:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 4,
    text:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 5,
    text:
      'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
];

export const BulkControllerStory = withInfo({
  text: 'RenderProps component for working with table bulk actions',
})(() => (
  <BulkController pageIds={dummy.map(d => d.id)} allIdsCount={23} noticeColumns={3}>
    {({
      selectedIds,
      onPageIdsToggle,
      onIdToggle,
      isPageSelected,
      // isEverythingSelected,
      tableNotice,
    }) => (
      <PanelTable
        headers={[
          <Checkbox
            key="bulk-checkbox"
            checked={isPageSelected}
            onChange={e => onPageIdsToggle(e.target.checked)}
          />,
          'Id',
          'Text',
        ]}
      >
        {tableNotice}

        {dummy.map(d => (
          <React.Fragment key={d.id}>
            <div>
              <Checkbox
                checked={selectedIds.includes(d.id)}
                onChange={() => onIdToggle(d.id)}
              />
            </div>
            <div>{d.id}</div>
            <div>{d.text}</div>
          </React.Fragment>
        ))}
      </PanelTable>
    )}
  </BulkController>
));
