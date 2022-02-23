import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import Fuse from 'fuse.js';

import AutoComplete from 'sentry/components/autoComplete';
import Button from 'sentry/components/button';
import Input from 'sentry/components/forms/controls/input';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

const sortProfiles = (profiles: ReadonlyArray<Profile>): ProfileGroup['profiles'] => {
  return [...profiles].sort((a, b) => {
    if (!b.duration) {
      return -1;
    }
    if (!a.duration) {
      return 1;
    }

    if (a.name.startsWith('(tid') && b.name.startsWith('(tid')) {
      return -1;
    }
    if (a.name.startsWith('(tid')) {
      return -1;
    }
    if (b.name.startsWith('(tid')) {
      return -1;
    }
    if (a.name.includes('main')) {
      return -1;
    }
    if (b.name.includes('main')) {
      return 1;
    }
    return a.name > b.name ? -1 : 1;
  });
};

interface ThreadSelectorProps {
  activeProfileIndex: ProfileGroup['activeProfileIndex'];
  onProfileIndexChange: (index: number) => void;
  profileGroup: ProfileGroup;
}

function ThreadMenuSelector(props: ThreadSelectorProps): React.ReactElement | null {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState<boolean>(false);

  const handleSelectItem = React.useCallback(
    (p: Fuse.FuseResultWithMatches<Profile & {index: number}>) => {
      const index = props.profileGroup.profiles.findIndex(
        profile => profile.name === p.item.name
      );
      if (index === -1) {
        return;
      }
      props.onProfileIndexChange(index);
    },
    [props.onProfileIndexChange, props.profileGroup]
  );

  React.useEffect(() => {
    const tagNamesToPreventStealingFocusFrom = new Set<Element['tagName']>([
      'INPUT',
      'TEXTAREA',
    ]);
    function handleKeyDown(evt) {
      if (tagNamesToPreventStealingFocusFrom.has(evt.target.tagName)) {
        return;
      }
      if (evt.key === 't' && !open) {
        evt.preventDefault();
        setOpen(true);
      }
      if (evt.key === 'Escape' && open) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useOnClickOutside(containerRef, () => {
    setOpen(false);
  });

  return (
    <div>
      <CurrentThreadButton size="zero" borderless onClick={() => setOpen(true)}>
        {props.profileGroup.profiles[props.activeProfileIndex]?.name ??
          t('Select Thread')}
      </CurrentThreadButton>
      <AutoComplete
        // @ts-ignore the type is typed as any
        onSelect={handleSelectItem}
        closeOnSelect={false}
        isOpen={open}
      >
        {({getInputProps, getItemProps, isOpen, inputValue, highlightedIndex}) => {
          const sortedProfiles = sortProfiles(props.profileGroup.profiles);
          const filteredProfiles = inputValue
            ? new Fuse(sortedProfiles, {includeMatches: true, keys: ['name']}).search(
                inputValue
              )
            : sortedProfiles.map(p => ({item: p, matches: [], score: 1}));

          return isOpen ? (
            <ThreadSelectorContainer ref={containerRef}>
              <Input
                type="search"
                autoFocus
                {...getInputProps({
                  onKeyDown: evt => {
                    if (evt.key === 'Escape') {
                      setOpen(false);
                    }
                  },
                })}
              />
              <DropdownBox>
                {filteredProfiles.length > 0 ? (
                  filteredProfiles.map((profile, index) => {
                    const activeProfile =
                      props.profileGroup.profiles[props.activeProfileIndex];

                    return (
                      <SearchResult
                        key={index}
                        highlighted={index === highlightedIndex}
                        ref={ref =>
                          index === highlightedIndex
                            ? ref?.scrollIntoView({block: 'nearest'})
                            : null
                        }
                        {...getItemProps({
                          // @ts-ignore the type is typed as any
                          item: profile,
                          index,
                        })}
                      >
                        {activeProfile.name === profile.item.name ? (
                          <IconCheckmark size="sm" style={{marginRight: space(1)}} />
                        ) : null}
                        {profile.item.name}
                      </SearchResult>
                    );
                  })
                ) : (
                  <EmptyItem>{t('No results found')}</EmptyItem>
                )}
              </DropdownBox>
            </ThreadSelectorContainer>
          ) : null;
        }}
      </AutoComplete>
    </div>
  );
}

const SearchResult = styled('li')<{highlighted: boolean}>`
  cursor: pointer;
  display: flex;
  align-items: center;
  color: ${p => p.theme.textColor};
  padding: ${space(1)} ${space(2)};

  ${p =>
    p.highlighted &&
    css`
      color: ${p.theme.purple300};
      background: ${p.theme.backgroundSecondary};
    `};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const EmptyItem = styled('li')`
  text-align: center;
  padding: 16px;
  opacity: 0.5;
`;

const DropdownBox = styled('ul')`
  list-style-type: none;
  padding: 0;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  right: 0;
  width: 100%;
  max-height: 60vh;
  border-radius: 5px;
  position: absolute;
  overflow-y: auto;
  top: 40px;
`;

const ThreadSelectorContainer = styled('div')`
  z-index: ${p => p.theme.zIndex.dropdown};
  border-radius: ${p => p.theme.borderRadius};
  position: absolute;
  max-width: 540px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  width: 50%;
  height: 80vh;
  left: 50%;
  transform: translate(-50%, 0);
  top: 60px;
`;

const CurrentThreadButton = styled(Button)`
  margin: 0 auto;
  display: block;
`;

export {ThreadMenuSelector};
