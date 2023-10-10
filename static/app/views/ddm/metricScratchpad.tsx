import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {uuid4} from '@sentry/utils';
import {AnimatePresence} from 'framer-motion';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {openConfirmModal} from 'sentry/components/confirm';
import InputControl from 'sentry/components/input';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IconBookmark, IconDelete, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {clearQuery, updateQuery} from 'sentry/utils/metrics';
import useKeyPress from 'sentry/utils/useKeyPress';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOverlay from 'sentry/utils/useOverlay';
import useRouter from 'sentry/utils/useRouter';

type Scratchpad = {
  id: string;
  name: string;
  query: Record<string, unknown>;
};

type ScratchpadState = {
  default: string | null;
  scratchpads: Record<string, Scratchpad>;
};

export function useScratchpads() {
  const [state, setState] = useLocalStorageState<ScratchpadState>('ddm-scratchpads', {
    default: null,
    scratchpads: {},
  });
  const [selected, setSelected] = useState<string | null | undefined>(state.default); // scratchpad id
  const router = useRouter();
  const routerQuery = useMemo(() => router.location.query ?? {}, [router.location.query]);

  // changes the query when a scratchpad is selected, clears it when none is selected
  useEffect(() => {
    if (selected) {
      const selectedQuery = state.scratchpads[selected].query;
      updateQuery(router, selectedQuery);
    } else if (selected === null) {
      clearQuery(router);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // saves all changes to the selected scratchpad to local storage
  useEffect(() => {
    if (selected) {
      update(selected, routerQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routerQuery]);

  const toggleSelected = useCallback(
    (id: string | null) => {
      if (id === selected) {
        setSelected(null);
      } else {
        setSelected(id);
      }
    },
    [setSelected, selected]
  );

  const setDefault = useCallback(
    (id: string | null) => {
      setState({...state, default: id});
    },
    [state, setState]
  );

  const add = useCallback(
    (name: string) => {
      const id = uuid4();
      const newScratchpads = {...state.scratchpads, [id]: {name, id, query: routerQuery}};
      setState({...state, scratchpads: newScratchpads});
      toggleSelected(id);
    },
    [state, setState, toggleSelected, routerQuery]
  );

  const update = useCallback(
    (id: string, query: Scratchpad['query']) => {
      const oldScratchpad = state.scratchpads[id];
      const newScratchpads = {...state.scratchpads, [id]: {...oldScratchpad, query}};
      setState({...state, scratchpads: newScratchpads});
    },
    [state, setState]
  );

  const remove = useCallback(
    (id: string) => {
      const newScratchpads = {...state.scratchpads};
      delete newScratchpads[id];
      if (state.default === id) {
        setState({...state, default: null, scratchpads: newScratchpads});
      } else {
        setState({...state, scratchpads: newScratchpads});
      }
      if (selected === id) {
        toggleSelected(null);
      }
    },
    [state, setState, toggleSelected, selected]
  );

  return {
    all: state.scratchpads,
    default: state.default,
    selected,
    add,
    update,
    remove,
    toggleSelected,
    setDefault,
  };
}

export function ScratchpadSelector() {
  const scratchpads = useScratchpads();

  const scratchpadOptions = useMemo(
    () =>
      Object.values(scratchpads.all).map((s: any) => ({
        value: s.id,
        label: s.name,
        trailingItems: (
          <Fragment>
            <StyledDropdownIcon>
              <IconDelete
                onClick={() => {
                  openConfirmModal({
                    onConfirm: () => scratchpads.remove(s.id),
                    message: t('Are you sure you want to delete this scratchpad?'),
                    confirmText: t('Delete'),
                  });
                }}
              />
            </StyledDropdownIcon>
          </Fragment>
        ),
      })),
    [scratchpads]
  );

  const isDefaultSelected = scratchpads.default === scratchpads.selected;

  return (
    <ScratchpadGroup>
      <Button
        disabled={!scratchpads.selected}
        onClick={() => {
          if (isDefaultSelected) {
            scratchpads.setDefault(null);
          } else {
            scratchpads.setDefault(scratchpads.selected ?? null);
          }
        }}
        icon={<IconBookmark isSolid={isDefaultSelected} />}
      >
        {isDefaultSelected ? t('Remove default') : t('Set as default')}
      </Button>
      <SaveAsDropdown
        onSave={name => {
          scratchpads.add(name);
        }}
        mode={scratchpads.selected ? 'fork' : 'save'}
      />
      <CompactSelect
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
  const [name, setName] = useState('');

  const save = useCallback(() => {
    onSave(name);
    setOpen(false);
    setName('');
  }, [name, onSave, setOpen]);

  const enterKeyPressed = useKeyPress('Enter', undefined, true);

  useEffect(() => {
    if (isOpen && enterKeyPressed && name) {
      save();
    }
  }, [enterKeyPressed, isOpen, name, save]);

  return (
    <div>
      <Button icon={<IconStar />} {...triggerProps}>
        {mode === 'fork' ? t('Fork as ...') : t('Save as ...')}
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
                <SaveAsButton
                  priority="primary"
                  disabled={!name}
                  onClick={() => {
                    save();
                  }}
                >
                  {mode === 'fork' ? t('Fork') : t('Save')}
                </SaveAsButton>
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

const StyledDropdownIcon = styled('span')`
  padding-top: ${space(0.5)};
  opacity: 0.6;

  :hover {
    opacity: 0.9;
    color: ${p => p.theme.red300};
  }
`;
