import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Shortcut, ShortcutRegistry} from 'sentry/utils/keyboardShortcuts/types';

import {KeyboardShortcut} from './keyboardKey';

interface ShortcutsHelpDrawerProps {
  activeShortcuts: Shortcut[];
  closeDrawer: () => void;
  registry: ShortcutRegistry;
}

/**
 * Drawer component that displays all available keyboard shortcuts
 */
export function ShortcutsHelpDrawer({
  activeShortcuts,
  registry,
}: ShortcutsHelpDrawerProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Always get fresh shortcuts from registry
  const currentShortcuts = registry.getShortcuts();

  // Group shortcuts by category with search filtering
  const shortcutsByCategory = useMemo(() => {
    const grouped = new Map<string, Shortcut[]>();

    // Use currentShortcuts from registry instead of activeShortcuts
    const shortcutsToUse =
      currentShortcuts.length > 0 ? currentShortcuts : activeShortcuts;

    // Filter shortcuts based on search query
    const filteredShortcuts = shortcutsToUse.filter(shortcut => {
      if (!searchQuery.trim()) {
        return true; // Show all shortcuts if no search query
      }

      const query = searchQuery.toLowerCase();
      const description = shortcut.description.toLowerCase();
      const category = (shortcut.context || 'global').toLowerCase();

      // Search in keyboard keys as well
      const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
      const keyStrings = keys.map(key => key.toLowerCase());
      const matchesKey = keyStrings.some(key => key.includes(query));

      // Search in description, category, and keyboard keys
      return description.includes(query) || category.includes(query) || matchesKey;
    });

    filteredShortcuts.forEach(shortcut => {
      const category = shortcut.context || 'global';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(shortcut);
    });

    // Sort categories with contextual shortcuts first, global last
    // Order: Issue Details contexts > Issues List > Global (includes navigation)
    const categoryOrder = [
      'issue-details-general',
      'issue-details-navigation',
      'issue-details-actions',
      'issue-details-events',
      'issue-details-drawers',
      'issue-details-workflow',
      'issues-list',
      'global',
    ];
    const sortedCategories = Array.from(grouped.keys()).sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    const result = new Map<string, Shortcut[]>();
    sortedCategories.forEach(category => {
      result.set(category, grouped.get(category)!);
    });

    return result;
  }, [activeShortcuts, currentShortcuts, searchQuery]);

  const getCategoryTitle = (category: string): string => {
    const titles: Record<string, string> = {
      global: t('Global'),
      'issues-list': t('Issues'),
      'issue-details-navigation': t('Issue Details - Navigation'),
      'issue-details-general': t('Issue Details - General'),
      'issue-details-actions': t('Issue Details - Actions'),
      'issue-details-events': t('Issue Details - Events'),
      'issue-details-drawers': t('Issue Details - Drawers'),
      'issue-details-workflow': t('Issue Details - Workflow'),
      actions: t('Actions'),
      search: t('Search & Filter'),
    };
    return titles[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <Fragment>
      <StyledDrawerHeader hideBar>
        <SearchInputContainer>
          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch color="subText" size="sm" />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              type="text"
              name="search"
              autoFocus
              autoComplete="off"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={t('Search keyboard shortcuts...')}
              size="sm"
            />
            <InputGroup.TrailingItems>
              {searchQuery && (
                <SearchClearButton
                  size="zero"
                  borderless
                  onClick={clearSearch}
                  icon={<IconClose size="xs" />}
                  aria-label={t('Clear search')}
                />
              )}
            </InputGroup.TrailingItems>
          </InputGroup>
        </SearchInputContainer>
      </StyledDrawerHeader>

      <DrawerBody>
        <ShortcutsList>
          {shortcutsByCategory.size === 0 && searchQuery.trim() ? (
            <NoResultsMessage>
              {t('No shortcuts found matching "%s"', searchQuery)}
            </NoResultsMessage>
          ) : (
            Array.from(shortcutsByCategory.entries()).map(([category, shortcuts]) => (
              <CategorySection key={category}>
                <CategoryTitle>{getCategoryTitle(category)}</CategoryTitle>
                <ShortcutsGrid>
                  {shortcuts.map(shortcut => (
                    <ShortcutRow key={shortcut.id}>
                      <ShortcutDescription>{shortcut.description}</ShortcutDescription>
                      <ShortcutKeys>
                        {Array.isArray(shortcut.key) ? (
                          shortcut.key.map((key, index) => (
                            <span key={index}>
                              <KeyboardShortcut shortcut={key} />
                              {index < shortcut.key.length - 1 && <OrText>or</OrText>}
                            </span>
                          ))
                        ) : (
                          <KeyboardShortcut shortcut={shortcut.key} />
                        )}
                      </ShortcutKeys>
                    </ShortcutRow>
                  ))}
                </ShortcutsGrid>
              </CategorySection>
            ))
          )}
        </ShortcutsList>
      </DrawerBody>
    </Fragment>
  );
}
const StyledDrawerHeader = styled(DrawerHeader)`
  display: flex;
  gap: ${p => p.theme.space.md};
`;

const ShortcutsList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};

  /* Custom scrollbar styling for the drawer body */
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  padding-right: ${space(1)};

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: ${p => p.theme.gray100};
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${p => p.theme.gray300};
    border-radius: 4px;

    &:hover {
      background: ${p => p.theme.gray400};
    }
  }
`;

const CategorySection = styled('div')`
  margin-bottom: ${space(2)};

  &:last-child {
    margin-bottom: 0;
  }
`;

const CategoryTitle = styled('h5')`
  color: ${p => p.theme.gray400};
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 ${space(1.5)} 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const ShortcutsGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ShortcutRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 4px;

  &:hover {
    background: ${p => p.theme.backgroundTertiary};
  }
`;

const ShortcutDescription = styled('span')`
  color: ${p => p.theme.textColor};
  font-size: 14px;
  flex: 1;
  margin-right: ${space(2)};
`;

const ShortcutKeys = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  flex-shrink: 0;
`;

const OrText = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: 12px;
  font-style: italic;
  margin: 0 ${space(0.5)};
`;

const SearchInputContainer = styled('div')`
  flex: 1;
`;

const SearchClearButton = styled(Button)`
  color: ${p => p.theme.gray300};

  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

const NoResultsMessage = styled('div')`
  text-align: center;
  color: ${p => p.theme.gray300};
  font-style: italic;
  padding: ${space(3)} ${space(2)};
  margin-top: ${space(2)};
`;
