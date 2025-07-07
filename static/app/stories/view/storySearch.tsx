import {useCallback, useMemo, useRef} from 'react';
import type {
  ComboBoxProps,
  InputProps,
  ListBoxItemProps,
  ValidationResult,
} from 'react-aria-components';
import {
  ComboBox,
  FieldError,
  InputContext,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  useContextProps,
} from 'react-aria-components';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Badge} from 'sentry/components/core/badge';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {normalizeFilename, useStoryTree} from 'sentry/stories/view/storyTree';
import {space} from 'sentry/styles/space';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {useStoryBookFiles} from './useStoriesLoader';

export function StorySearch() {
  const searchInput = useRef<HTMLInputElement | null>(null);
  const files = useStoryBookFiles();
  const tree = useStoryTree(files, {query: '', representation: 'category', type: 'flat'});
  const storiesSearchHotkeys = useMemo(() => {
    return [{match: '/', callback: () => searchInput.current?.focus()}];
  }, []);
  useHotkeys(storiesSearchHotkeys);
  const location = useLocation();
  const defaultSelectedKey = location.query.name as string;

  return (
    <SearchComboBox
      label={t('Search stories')}
      defaultItems={tree.map(node => {
        return {id: node.filesystemPath, name: normalizeFilename(node.name)};
      })}
      defaultSelectedKey={defaultSelectedKey}
      menuTrigger="focus"
      inputRef={searchInput}
    >
      {item => (
        <SearchItem key={item.id} textValue={item.name}>
          <Text slot="label">{item.name}</Text>
        </SearchItem>
      )}
    </SearchComboBox>
  );
}

function SearchInput(props: InputProps & React.RefAttributes<HTMLInputElement>) {
  [props, props.ref] = useContextProps(props, props.ref ?? {current: null}, InputContext);
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

interface SearchComboBoxProps<T extends Record<PropertyKey, unknown>>
  extends Omit<ComboBoxProps<T>, 'children'> {
  children: React.ReactNode | ((item: T) => React.ReactNode);
  description?: string | null;
  errorMessage?: string | ((validation: ValidationResult) => string);
  inputRef?: React.RefObject<HTMLInputElement | null>;
  label?: string;
}

function SearchComboBox<T extends Record<PropertyKey, unknown>>({
  label,
  errorMessage,
  children,
  inputRef,
  ...props
}: SearchComboBoxProps<T>) {
  const navigate = useNavigate();
  const handleSelectionChange = useCallback(
    (key: string | number | boolean | null) => {
      if (!key) {
        return;
      }
      navigate(`/stories?name=${encodeURIComponent(key)}`, {replace: true});
    },
    [navigate]
  );

  return (
    <ComboBox {...props} onSelectionChange={handleSelectionChange}>
      <Label className="sr-only">{label}</Label>
      <SearchInput ref={inputRef} placeholder={label} />
      <FieldError>{errorMessage}</FieldError>
      <Popover>
        <StorySearchContainer>
          <ListBox
            selectionBehavior="replace"
            disallowEmptySelection
            selectionMode="single"
          >
            {children}
          </ListBox>
        </StorySearchContainer>
      </Popover>
    </ComboBox>
  );
}

function SearchItem(props: ListBoxItemProps) {
  const theme = useTheme();

  return (
    <StyledItem
      {...props}
      style={({isFocused, isSelected}) => ({
        color: isSelected
          ? theme.tokens.content.accent
          : isFocused
            ? theme.tokens.content.primary
            : undefined,
        '--selection-opacity': isFocused ? 1 : 0,
        '--bar-opacity': isFocused || isSelected ? 1 : 0,
        '--bar-color': isSelected
          ? theme.tokens.graphics.accent
          : isFocused
            ? theme.tokens.graphics.muted
            : undefined,
      })}
    >
      {props.children}
    </StyledItem>
  );
}

const StyledItem = styled(ListBoxItem)`
  display: flex;
  flex-direction: column;
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(0.75)};
  color: ${p => p.theme.tokens.content.muted};
  position: relative;
  transition: none;
  --selection-opacity: 0;
  --bar-opacity: 0;
  --bar-color: ${p => p.theme.tokens.graphics.muted};

  &:before {
    background: ${p => p.theme.gray100};
    content: '';
    inset: 0 ${space(0.25)} 0 -${space(0.25)};
    position: absolute;
    z-index: -1;
    border-radius: ${p => p.theme.borderRadius};
    opacity: var(--selection-opacity, 0);
  }

  &:after {
    content: '';
    position: absolute;
    left: -8px;
    height: 20px;
    background: var(--bar-color);
    width: 4px;
    border-radius: ${p => p.theme.borderRadius};
    opacity: var(--bar-opacity, 0);
    transition: none;
  }

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    --selection-opacity: 1;

    &:before {
      opacity: 1;
    }
  }
`;

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
