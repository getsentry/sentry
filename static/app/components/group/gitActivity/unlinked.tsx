import * as React from 'react';
import styled from '@emotion/styled';

import MenuItemActionLink from 'app/components/actions/menuItemActionLink';
import Button from 'app/components/button';
import DropdownLink from 'app/components/dropdownLink';
import {IconAdd} from 'app/icons';
import space from 'app/styles/space';

import {GitActivity} from '.';

type Prop = {
  unlinkedActivities: GitActivity[];
  onRelink: (activity: GitActivity) => Promise<void>;
};

function UnlinkedActivity({unlinkedActivities, onRelink}: Prop) {
  return (
    <React.Fragment>
      <DropdownLinkContainer>
        <DropdownLink
          customTitle={
            <Button icon={<IconAdd size="xs" />} size="xsmall" borderless>
              {' '}
              {'Re-link Github Activity'}{' '}
            </Button>
          }
          caret={false}
          alwaysRenderMenu
        >
          {unlinkedActivities.map(unlinked => (
            <MenuItemActionLink
              key={unlinked.id}
              title={unlinked.title}
              onAction={() => onRelink(unlinked)}
            >
              {unlinked.title}
            </MenuItemActionLink>
          ))}
        </DropdownLink>
      </DropdownLinkContainer>
    </React.Fragment>
  );
}

const DropdownLinkContainer = styled('div')`
  padding: ${space(1)} 0;
`;

export default UnlinkedActivity;
