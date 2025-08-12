import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Shortcut, ShortcutRegistry} from 'sentry/utils/keyboardShortcuts/types';

import {KeyboardShortcut} from './keyboardKey';

interface ShortcutsHelpModalProps extends ModalRenderProps {
  activeShortcuts: Shortcut[];
  registry: ShortcutRegistry;
}

/**
 * Modal component that displays all available keyboard shortcuts
 */
export function ShortcutsHelpModal({
  Header,
  Body,
  Footer,
  closeModal,
  activeShortcuts,
  registry,
}: ShortcutsHelpModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Always get fresh shortcuts from registry
  const currentShortcuts = registry.getShortcuts();
  console.log('[ShortcutsHelpModal] Received activeShortcuts:', activeShortcuts);
  console.log('[ShortcutsHelpModal] Registry shortcuts:', currentShortcuts);

  // Group shortcuts by category
  const shortcutsByCategory = useMemo(() => {
    const grouped = new Map<string, Shortcut[]>();

    // Use currentShortcuts from registry instead of activeShortcuts
    const shortcutsToUse =
      currentShortcuts.length > 0 ? currentShortcuts : activeShortcuts;
    console.log('[ShortcutsHelpModal] Grouping shortcuts, count:', shortcutsToUse.length);

    shortcutsToUse.forEach(shortcut => {
      const category = shortcut.category || 'other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(shortcut);
    });

    // Sort categories with a specific order
    const categoryOrder = ['global', 'navigation', 'actions', 'search'];
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

    console.log(
      '[ShortcutsHelpModal] Grouped into categories:',
      Array.from(result.keys())
    );

    return result;
  }, [activeShortcuts, currentShortcuts]);

  // Filter shortcuts based on search term
  const filteredCategories = useMemo(() => {
    console.log('[ShortcutsHelpModal] Filtering with searchTerm:', searchTerm);
    if (!searchTerm) {
      console.log('[ShortcutsHelpModal] No search term, returning all categories');
      return shortcutsByCategory;
    }

    const filtered = new Map<string, Shortcut[]>();
    const lowerSearch = searchTerm.toLowerCase();

    shortcutsByCategory.forEach((shortcuts, category) => {
      const matchingShortcuts = shortcuts.filter(shortcut => {
        const descMatch = shortcut.description.toLowerCase().includes(lowerSearch);
        const keyMatch = (
          Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key]
        ).some(k => k.toLowerCase().includes(lowerSearch));
        const categoryMatch = category.toLowerCase().includes(lowerSearch);

        return descMatch || keyMatch || categoryMatch;
      });

      if (matchingShortcuts.length > 0) {
        filtered.set(category, matchingShortcuts);
      }
    });

    return filtered;
  }, [shortcutsByCategory, searchTerm]);

  console.log('[ShortcutsHelpModal] filteredCategories.size:', filteredCategories.size);

  const getCategoryTitle = (category: string): string => {
    const titles: Record<string, string> = {
      global: t('Global'),
      navigation: t('Navigation'),
      actions: t('Actions'),
      search: t('Search & Filter'),
    };
    return titles[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <Container>
      <Header closeButton>
        <h4>{t('Keyboard Shortcuts')}</h4>
      </Header>

      <Body>
        <SearchContainer>
          <StyledInput
            type="search"
            placeholder={t('Search shortcuts...')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            autoFocus
          />
        </SearchContainer>

        <ShortcutsList>
          {filteredCategories.size === 0 ? (
            <EmptyMessage>
              {t('No shortcuts found matching "%s"', searchTerm)}
            </EmptyMessage>
          ) : (
            Array.from(filteredCategories.entries()).map(([category, shortcuts]) => (
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
      </Body>

      <Footer>
        <Button onClick={closeModal}>{t('Close')}</Button>
      </Footer>
    </Container>
  );
}

const Container = styled('div')`
  max-width: 90vw;
`;

const SearchContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledInput = styled(Input)`
  width: 100%;
`;

const ShortcutsList = styled('div')`
  max-height: 60vh;
  overflow-y: auto;
  padding-right: ${space(1)};

  /* Custom scrollbar styling */
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
  margin-bottom: ${space(3)};

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
`;

const ShortcutKeys = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const OrText = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: 12px;
  font-style: italic;
  margin: 0 ${space(0.5)};
`;

const EmptyMessage = styled('div')`
  text-align: center;
  color: ${p => p.theme.gray300};
  padding: ${space(4)} 0;
  font-size: 14px;
`;
