import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Badge} from 'sentry/components/core/badge';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Overlay} from 'sentry/components/overlay';
import {IconSearch} from 'sentry/icons/iconSearch';
import {space} from 'sentry/styles/space';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {StoryTree, useStoryTree} from './storyTree';
import {useStoryBookFiles} from './useStoriesLoader';

export function StorySearch() {
  const searchInput = useRef<HTMLInputElement>(null);
  const location = useLocation<{name: string; query?: string}>();
  const [showSearch, setShowSearch] = useState(false);
  const files = useStoryBookFiles();
  const query = location.query.query ?? '';
  useEffect(() => {
    setShowSearch(query.length !== 0);
  }, [query]);
  const dismiss = useCallback(() => {
    setShowSearch(false);
    location.query.query = undefined;
  }, [setShowSearch, location]);
  const searchTree = useStoryTree(files, {
    query,
    representation: 'category',
    type: 'flat',
  });
  const navigate = useNavigate();
  const onSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      navigate(
        {
          query: {...location.query, query: e.target.value, name: location.query.name},
        },
        {replace: true}
      );
    },
    [location.query, navigate]
  );

  const storiesSearchHotkeys = useMemo(() => {
    return [{match: '/', callback: () => searchInput.current?.focus()}];
  }, []);
  useHotkeys(storiesSearchHotkeys);

  return (
    <Fragment>
      <InputGroup style={{minHeight: 33, height: 33, width: 256}}>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          ref={el => {
            searchInput.current = el;
            const cb = () => setShowSearch(true);
            el?.addEventListener('focus', cb);
            return () => el?.removeEventListener('focus', cb);
          }}
          placeholder="Search stories"
          defaultValue={location.query.query ?? ''}
          onChange={onSearchInputChange}
        />
        <InputGroup.TrailingItems>
          <Badge type="internal">/</Badge>
        </InputGroup.TrailingItems>
        {/* @TODO (JonasBadalic): Implement clear button when there is an active query */}
      </InputGroup>
      {showSearch && (
        <Overlay
          onClick={dismiss}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              dismiss();
            }
          }}
        >
          <StorySearchContainer>
            <StoryTree nodes={searchTree} />
          </StorySearchContainer>
        </Overlay>
      )}
    </Fragment>
  );
}

const StorySearchContainer = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom-width: 3px;
  border-radius: ${p => p.theme.borderRadius};
  position: fixed;
  top: 48px;
  left: 272px;
  width: 320px;
  flex-grow: 1;
  z-index: calc(infinity);
  padding: ${space(1)};
  padding-right: 0;
  overflow-y: auto;
  max-height: 80vh;

  ul {
    margin: 0;
  }
`;
