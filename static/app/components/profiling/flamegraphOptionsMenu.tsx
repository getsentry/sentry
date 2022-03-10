import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphPreferencesProvider';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';

interface FlamegraphOptionsMenuProps {
  canvasPoolManager: CanvasPoolManager;
}

function FlamegraphOptionsMenu({
  canvasPoolManager,
}: FlamegraphOptionsMenuProps): React.ReactElement {
  const [{colorCoding}, dispatch] = useFlamegraphPreferences();

  return (
    <OptionsMenuContainer>
      <DropdownControl
        button={({isOpen, getActorProps}) => (
          <DropdownButton
            {...getActorProps()}
            isOpen={isOpen}
            prefix={t('Color Coding')}
            size="xsmall"
          >
            {COLOR_CODINGS[colorCoding]}
          </DropdownButton>
        )}
      >
        {Object.entries(COLOR_CODINGS).map(
          ([value, label]: [string, string]): React.ReactElement => (
            <DropdownItem
              key={value}
              onSelect={() =>
                dispatch({
                  type: 'set color coding',
                  value: value as FlamegraphPreferences['colorCoding'],
                })
              }
              eventKey={value}
              isActive={value === colorCoding}
            >
              {label}
            </DropdownItem>
          )
        )}
      </DropdownControl>
      <Button size="xsmall" onClick={() => canvasPoolManager.dispatch('resetZoom', [])}>
        {t('Reset Zoom')}
      </Button>
    </OptionsMenuContainer>
  );
}

const COLOR_CODINGS: Record<FlamegraphPreferences['colorCoding'], string> = {
  'by symbol name': t('By Symbol Name'),
  'by library': t('By Library'),
  'by system / application': t('By System / Application'),
  'by recursion': t('By Recursion'),
};

const OptionsMenuContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
  justify-content: flex-end;
`;

export {FlamegraphOptionsMenu};
