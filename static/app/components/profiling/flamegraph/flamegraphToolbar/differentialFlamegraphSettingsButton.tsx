import {Fragment, useCallback, useState} from 'react';
import {createPortal} from 'react-dom';
import {autoUpdate, offset, useFloating} from '@floating-ui/react-dom';
import {IconSettings} from '@sentry/icons/settings';

import {Button} from '@sentry/scraps/button';

import {DifferentialFlamegraphMenu} from 'sentry/components/profiling/flamegraph/flamegraphContextMenu';
import {t} from 'sentry/locale';
import {flipOverlay, shiftOverlay} from 'sentry/utils/overlayPositioning';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {useOnClickOutside} from 'sentry/utils/useOnClickOutside';

const MENU_MIDDLEWARE = [
  offset({crossAxis: -162, mainAxis: 4}),
  flipOverlay(),
  shiftOverlay(),
];

interface DifferentialFlamegraphSettingsButtonProps {
  frameFilter: 'application' | 'system' | 'all';
  onFrameFilterChange: (type: 'application' | 'system' | 'all') => void;
}

export function DifferentialFlamegraphSettingsButton(
  props: DifferentialFlamegraphSettingsButtonProps
) {
  // TODO: Use ref callbacks instead of holding the button and dropdown elements in state
  const [buttonRef, setButtonRef] = useState<HTMLElement | null>(null);
  const [dropdownRef, setDropdownRef] = useState<HTMLElement | null>(null);

  const {floatingStyles} = useFloating({
    elements: {reference: buttonRef, floating: dropdownRef},
    placement: 'bottom-end',
    strategy: 'fixed',
    middleware: MENU_MIDDLEWARE,
    whileElementsMounted: autoUpdate,
  });

  const contextMenu = useContextMenu({container: null});

  const onToggleMenu = () => {
    contextMenu.setOpen(!contextMenu.open);
  };

  const onClose = useCallback(() => {
    contextMenu.setOpen(false);
  }, [contextMenu]);

  useOnClickOutside(dropdownRef, onClose);

  return (
    <Fragment>
      <Button
        ref={setButtonRef}
        icon={<IconSettings />}
        size="xs"
        aria-label={t('Differential Flamegraph Settings')}
        onClick={onToggleMenu}
      />
      {contextMenu.open
        ? createPortal(
            <div ref={setDropdownRef} style={floatingStyles}>
              <DifferentialFlamegraphMenu
                onClose={onClose}
                contextMenu={contextMenu}
                frameFilter={props.frameFilter}
                onFrameFilterChange={props.onFrameFilterChange}
              />
            </div>,
            document.body
          )
        : null}
    </Fragment>
  );
}
