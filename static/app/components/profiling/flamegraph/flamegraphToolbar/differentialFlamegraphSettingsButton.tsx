import {Fragment, useCallback, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePopper} from 'react-popper';

import {Button} from 'sentry/components/button';
import {DifferentialFlamegraphMenu} from 'sentry/components/profiling/flamegraph/flamegraphContextMenu';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

interface DifferentialFlamegraphSettingsButtonProps {
  frameFilter: 'application' | 'system' | 'all';
  onFrameFilterChange: (type: 'application' | 'system' | 'all') => void;
}

export function DifferentialFlamegraphSettingsButton(
  props: DifferentialFlamegraphSettingsButtonProps
) {
  const [buttonRef, setButtonRef] = useState<HTMLElement | null>(null);
  const [dropdownRef, setDropdownRef] = useState<HTMLElement | null>(null);

  const popper = usePopper(buttonRef, dropdownRef, {
    placement: 'bottom-end',
    strategy: 'fixed',
    modifiers: [{name: 'offset', options: {offset: [-162, 4]}}],
  });

  const contextMenu = useContextMenu({container: null});

  const onToggleMenu = useCallback(() => {
    contextMenu.setOpen(!contextMenu.open);
  }, [contextMenu]);

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
            <div
              ref={setDropdownRef}
              style={popper.styles.popper}
              {...popper.attributes.popper}
            >
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
