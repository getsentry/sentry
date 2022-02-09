import styled from '@emotion/styled';

import Button from 'sentry/components/button';

interface FlamegraphViewSelectMenuProps {
  view: 'top down' | 'bottom up';
  sorting: 'call order' | 'left heavy';
  onViewChange: (view: FlamegraphViewSelectMenuProps['view']) => void;
  onSortingChange: (sorting: FlamegraphViewSelectMenuProps['sorting']) => void;
}

function FlamegraphViewSelectMenu({
  view,
  onViewChange,
  sorting,
  onSortingChange,
}: FlamegraphViewSelectMenuProps): React.ReactElement {
  return (
    <ViewSelectMenu>
      <Button
        size="xsmall"
        priority={sorting === 'call order' ? 'primary' : undefined}
        onClick={() => onSortingChange('call order')}
      >
        Call Order
      </Button>
      <Button
        size="xsmall"
        priority={sorting === 'left heavy' ? 'primary' : undefined}
        onClick={() => onSortingChange('left heavy')}
      >
        Left Heavy
      </Button>
      <Button
        size="xsmall"
        priority={view === 'bottom up' ? 'primary' : undefined}
        onClick={() => onViewChange('bottom up')}
      >
        Bottom Up
      </Button>
      <Button
        size="xsmall"
        priority={view === 'top down' ? 'primary' : undefined}
        onClick={() => onViewChange('top down')}
      >
        Top Down
      </Button>
    </ViewSelectMenu>
  );
}

const ViewSelectMenu = styled('div')`
  padding: 0 0;
  flex: 1;
  height: 100%;
`;

export {FlamegraphViewSelectMenu};
