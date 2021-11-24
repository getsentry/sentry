import {Fragment} from 'react';
import styled from '@emotion/styled';

import BulkController from 'sentry/components/bulkController';
import Checkbox from 'sentry/components/checkbox';
import {PanelTable} from 'sentry/components/panels';

const dummy = [
  {
    id: 1,
    text: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 2,
    text: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 3,
    text: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 4,
    text: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
  {
    id: 5,
    text: 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusantium autem placeat corrupti sapiente optio. Sapiente, aut exercitationem nisi nesciunt molestiae perspiciatis ad illo at officiis porro quam voluptas explicabo quod.',
  },
];

const pageIds = dummy.map(d => d.id);

export default {
  title: 'Components/Tables/BulkController',
  component: BulkController,
};

export const _BulkController = () => (
  <BulkController
    pageIds={pageIds}
    defaultSelectedIds={pageIds.slice(0, 2)}
    allRowsCount={23}
    columnsCount={3}
    bulkLimit={1000}
  >
    {({selectedIds, onPageRowsToggle, onRowToggle, isPageSelected, renderBulkNotice}) => (
      <PanelTable
        headers={[
          <StyledCheckbox
            key="bulk-checkbox"
            checked={isPageSelected}
            onChange={e => onPageRowsToggle(e.target.checked)}
          />,
          'Id',
          'Text',
        ]}
      >
        {renderBulkNotice()}

        {dummy.map(d => (
          <Fragment key={d.id}>
            <div>
              <StyledCheckbox
                checked={selectedIds.includes(d.id)}
                onChange={() => onRowToggle(d.id)}
              />
            </div>
            <div>{d.id}</div>
            <div>{d.text}</div>
          </Fragment>
        ))}
      </PanelTable>
    )}
  </BulkController>
);
_BulkController.storyName = 'BulkController';
_BulkController.parameters = {
  docs: {
    description: {
      story: 'Nearly empty state will still show 1 bar if there are any miserable users',
    },
  },
};

const StyledCheckbox = styled(Checkbox)`
  margin-top: 0 !important;
`;
