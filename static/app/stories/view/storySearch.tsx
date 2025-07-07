import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {useComboBox} from '@react-aria/combobox';
import {useComboBoxState} from '@react-stately/combobox';
import {useListState} from '@react-stately/list';

import {Badge} from 'sentry/components/core/badge';
import {ListBox} from 'sentry/components/core/compactSelect/listBox';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Overlay} from 'sentry/components/overlay';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {StoryTreeNode} from 'sentry/stories/view/storyTree';
import {useStoryTree} from 'sentry/stories/view/storyTree';
import {space} from 'sentry/styles/space';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';

import {useStoryBookFiles} from './useStoriesLoader';

export function StorySearch() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listBoxRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const labelRef = useRef<HTMLElement | null>(null);
  const files = useStoryBookFiles();
  const tree = useStoryTree(files, {query: '', representation: 'category', type: 'flat'});
  const storiesSearchHotkeys = useMemo(() => {
    return [{match: '/', callback: () => inputRef.current?.focus()}];
  }, []);
  useHotkeys(storiesSearchHotkeys);
  const location = useLocation();
  const defaultSelectedKey = location.query.name as string;

  return (
    <SearchComboBox
      label={t('Search stories')}
      defaultItems={tree}
      defaultSelectedKey={defaultSelectedKey}
      menuTrigger="focus"
      listBoxRef={listBoxRef}
      labelRef={labelRef}
      inputRef={inputRef}
      popoverRef={popoverRef}
      items={tree}
    >
      {tree}
    </SearchComboBox>
  );
}

function SearchInput(
  props: React.HTMLProps<HTMLInputElement> & React.RefAttributes<HTMLInputElement>
) {
  const {className: _0, style: _1, size: nativeSize, ...nativeProps} = props;

  return (
    <InputGroup style={{minHeight: 33, height: 33, width: 256}}>
      <InputGroup.LeadingItems disablePointerEvents>
        <IconSearch />
      </InputGroup.LeadingItems>
      <InputGroup.Input ref={props.ref} nativeSize={nativeSize} {...nativeProps} />
      <InputGroup.TrailingItems>
        <Badge type="internal">/</Badge>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

interface SearchComboBoxProps<T extends StoryTreeNode>
  extends Omit<AriaComboBoxProps<T>, 'children'> {
  children: Iterable<T>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  labelRef: React.RefObject<HTMLElement | null>;
  listBoxRef: React.RefObject<HTMLElement | null>;
  popoverRef: React.RefObject<HTMLElement | null>;
  description?: string | null;
  label?: string;
}

function SearchComboBox<T extends StoryTreeNode>({
  label,
  inputRef,
  listBoxRef,
  popoverRef,
  children,
  defaultItems,
  ...props
}: SearchComboBoxProps<T>) {
  // const navigate = useNavigate();
  const state = useComboBoxState(props);
  const listState = useListState<StoryTreeNode>({
    items: defaultItems,
    selectionMode: 'single',
    selectionBehavior: 'replace',
    disallowEmptySelection: true,
    *filter(nodes) {
      if (!state.inputValue) {
        yield* nodes;
        return;
      }
      for (const node of nodes) {
        if (node.textValue.includes(state.inputValue)) {
          yield node;
        }
      }
    },
  });
  const {labelProps, inputProps, listBoxProps} = useComboBox(
    {...props, items: children, inputRef, popoverRef, listBoxRef},
    state
  );
  // const handleAction = useCallback(
  //   (key: string | number | boolean | null) => {
  //     if (!key) {
  //       return;
  //     }
  //     navigate(`/stories?name=${encodeURIComponent(key)}`, {replace: true});
  //   },
  //   [navigate]
  // );

  return (
    <div {...props}>
      <label {...labelProps} className="sr-only">
        {label}
      </label>
      <SearchInput ref={inputRef} placeholder={label} {...inputProps} />
      <Overlay>
        <StorySearchContainer>
          <ListBox listState={listState} keyDownHandler={() => false} {...listBoxProps} />
        </StorySearchContainer>
      </Overlay>
    </div>
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
