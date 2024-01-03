import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import * as Sentry from '@sentry/react';
import {AnimatePresence} from 'framer-motion';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {openConfirmModal} from 'sentry/components/confirm';
import InputControl from 'sentry/components/input';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {Tooltip} from 'sentry/components/tooltip';
import {IconBookmark, IconDashboard, IconDelete, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOrganization from 'sentry/utils/useOrganization';
import useOverlay from 'sentry/utils/useOverlay';
import {useScratchpads} from 'sentry/views/ddm/scratchpadContext';

import {useCreateDashboard} from './useCreateDashboard';

export function ScratchpadSelector() {
  const scratchpads = useScratchpads();
  const organization = useOrganization();
  const createDashboard = useCreateDashboard();

  const isDefault = useCallback(
    scratchpad => scratchpads.default === scratchpad.id,
    [scratchpads]
  );

  const scratchpadOptions = useMemo(
    () =>
      Object.values(scratchpads.all).map((s: any) => ({
        value: s.id,
        label: s.name,
        trailingItems: (
          <Fragment>
            <Tooltip
              title={
                isDefault(s)
                  ? t('Remove as default scratchpad')
                  : t('Set as default scratchpad')
              }
            >
              <Button
                size="zero"
                borderless
                onPointerDown={e => e.stopPropagation()}
                onClick={() => {
                  trackAnalytics('ddm.scratchpad.set-default', {
                    organization,
                  });
                  Sentry.metrics.increment('ddm.scratchpad.set_default');

                  if (isDefault(s)) {
                    scratchpads.setDefault(null);
                  } else {
                    scratchpads.setDefault(s.id ?? null);
                  }
                }}
              >
                <StyledDropdownIcon>
                  <IconBookmark isSolid={isDefault(s)} />
                </StyledDropdownIcon>
              </Button>
            </Tooltip>
            <Tooltip title={t('Remove scratchpad')}>
              <Button
                size="zero"
                borderless
                onPointerDown={e => e.stopPropagation()}
                onClick={() => {
                  openConfirmModal({
                    onConfirm: () => {
                      trackAnalytics('ddm.scratchpad.remove', {
                        organization,
                      });
                      Sentry.metrics.increment('ddm.scratchpad.remove');

                      return scratchpads.remove(s.id);
                    },
                    message: t('Are you sure you want to delete this scratchpad?'),
                    confirmText: t('Delete'),
                  });
                }}
              >
                <StyledDropdownIcon danger>
                  <IconDelete size="sm" />
                </StyledDropdownIcon>
              </Button>
            </Tooltip>
          </Fragment>
        ),
      })),
    [scratchpads, isDefault, organization]
  );

  const selectedScratchpad = scratchpads.selected
    ? scratchpads.all[scratchpads.selected]
    : undefined;

  return (
    <ScratchpadGroup>
      <Button
        icon={<IconDashboard />}
        onClick={() => {
          Sentry.metrics.increment('ddm.scratchpad.dashboard');
          createDashboard(selectedScratchpad);
        }}
      >
        {t('Add to Dashboard')}
      </Button>
      <SaveAsDropdown
        onSave={name => {
          scratchpads.add(name);
        }}
        mode={scratchpads.selected ? 'fork' : 'save'}
      />
      <CompactSelect
        grid
        options={scratchpadOptions}
        value={scratchpads.selected ?? `None`}
        closeOnSelect={false}
        onChange={option => {
          scratchpads.toggleSelected(option.value);
        }}
        triggerProps={{prefix: t('Scratchpad')}}
        emptyMessage="No scratchpads yet."
        disabled={false}
      />
    </ScratchpadGroup>
  );
}

function SaveAsDropdown({
  onSave,
  mode,
}: {
  mode: 'save' | 'fork';
  onSave: (name: string) => void;
}) {
  const {
    isOpen,
    triggerProps,
    overlayProps,
    arrowProps,
    state: {setOpen},
  } = useOverlay({});
  const theme = useTheme();
  const organization = useOrganization();
  const [name, setName] = useState('');

  const save = useCallback(() => {
    trackAnalytics('ddm.scratchpad.save', {
      organization,
    });
    Sentry.metrics.increment('ddm.scratchpad.save');

    onSave(name);
    setOpen(false);
    setName('');
  }, [name, onSave, setOpen, organization]);

  const enterKeyPressed = useKeyPress('Enter');

  useEffect(() => {
    if (isOpen && enterKeyPressed && name) {
      save();
    }
  }, [enterKeyPressed, isOpen, name, save]);

  const isFork = mode === 'fork';

  return (
    <div>
      <Button icon={isFork ? null : <IconStar isSolid={isFork} />} {...triggerProps}>
        {isFork ? `${t('Duplicate as')}\u2026` : `${t('Save as')}\u2026`}
      </Button>
      <AnimatePresence>
        {isOpen && (
          <FocusScope contain restoreFocus autoFocus>
            <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
              <StyledOverlay arrowProps={arrowProps} animated>
                <SaveAsInput
                  type="txt"
                  name="scratchpad-name"
                  placeholder={t('Scratchpad name')}
                  value={name}
                  size="sm"
                  onChange={({target}) => setName(target.value)}
                />
                <GuideAnchor target="create_scratchpad" position="bottom">
                  <SaveAsButton
                    priority="primary"
                    disabled={!name}
                    onClick={() => {
                      save();
                    }}
                  >
                    {mode === 'fork' ? t('Duplicate') : t('Save')}
                  </SaveAsButton>
                </GuideAnchor>
              </StyledOverlay>
            </PositionWrapper>
          </FocusScope>
        )}
      </AnimatePresence>
    </div>
  );
}

const ScratchpadGroup = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledOverlay = styled(Overlay)`
  padding: ${space(1)};
`;

const SaveAsButton = styled(Button)`
  width: 100%;
`;

const SaveAsInput = styled(InputControl)`
  margin-bottom: ${space(1)};
`;

const StyledDropdownIcon = styled('span')<{danger?: boolean}>`
  padding: ${space(0.5)} ${space(0.5)} 0 ${space(0.5)};
  opacity: 0.5;

  :hover {
    opacity: 0.9;
    color: ${p => (p.danger ? p.theme.red300 : p.theme.gray300)};
  }
`;
