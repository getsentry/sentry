import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

interface FlamegraphViewSelectMenuProps {
  onSortingChange: (sorting: FlamegraphViewSelectMenuProps['sorting']) => void;
  onViewChange: (view: FlamegraphViewSelectMenuProps['view']) => void;
  sorting: 'call order' | 'left heavy';
  view: 'top down' | 'bottom up';
}

function FlamegraphViewSelectMenu({
  view,
  onViewChange,
  sorting,
  onSortingChange,
}: FlamegraphViewSelectMenuProps): React.ReactElement {
  return (
    <SelectMenuContainer>
      <ButtonBar merged active={sorting}>
        <Button
          barId="call order"
          size="xsmall"
          onClick={() => onSortingChange('call order')}
        >
          {t('Call Order')}
        </Button>
        <Button
          barId="left heavy"
          size="xsmall"
          onClick={() => onSortingChange('left heavy')}
        >
          {t('Left Heavy')}
        </Button>
      </ButtonBar>
      <ButtonBar merged active={view}>
        <Button barId="bottom up" size="xsmall" onClick={() => onViewChange('bottom up')}>
          {t('Bottom Up')}
        </Button>
        <Button barId="top down" size="xsmall" onClick={() => onViewChange('top down')}>
          {t('Top Down')}
        </Button>
      </ButtonBar>
    </SelectMenuContainer>
  );
}

const SelectMenuContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  justify-content: flex-start;
`;

export {FlamegraphViewSelectMenu};
