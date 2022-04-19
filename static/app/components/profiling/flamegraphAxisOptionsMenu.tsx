import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';

function FlamegraphXAxisOptionsMenu(): React.ReactElement {
  const [{synchronizeXAxisWithTransaction}, dispatch] = useFlamegraphPreferences();

  return (
    <OptionsMenuContainer>
      <DropdownControl
        button={({isOpen, getActorProps}) => (
          <DropdownButton
            {...getActorProps()}
            isOpen={isOpen}
            prefix={t('X Axis')}
            size="xsmall"
          >
            {synchronizeXAxisWithTransaction ? 'Transaction' : 'Standalone'}
          </DropdownButton>
        )}
      >
        <DropdownItem
          onSelect={() =>
            dispatch({
              type: 'set synchronizeXAxisWithTransaction',
              payload: false,
            })
          }
          isActive={!synchronizeXAxisWithTransaction}
        >
          Standalone
        </DropdownItem>
        <DropdownItem
          onSelect={() =>
            dispatch({
              type: 'set synchronizeXAxisWithTransaction',
              payload: true,
            })
          }
          isActive={synchronizeXAxisWithTransaction}
        >
          Transaction
        </DropdownItem>
      </DropdownControl>
    </OptionsMenuContainer>
  );
}

const OptionsMenuContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  justify-content: flex-end;
`;

export {FlamegraphXAxisOptionsMenu};
