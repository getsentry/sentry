import {useMemo, useRef, useState} from 'react';

import {getItemsWithKeys, type SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import type {
  SuggestionItem,
  SuggestionSection,
  SuggestionSectionItem,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueSuggestions/types';

type FrozenSuggestionOrder = Array<{sectionText: string; values: string[]}>;

type Props = {
  createItem: (suggestion: SuggestionItem) => Omit<SelectOptionWithKey<string>, 'key'>;
  selectedValues: Array<{selected: boolean; value: string}>;
  suggestionGroups: SuggestionSection[];
};

function suggestionGroupsAffectOrderChanged(
  previousSuggestionGroups: SuggestionSection[] | null,
  nextSuggestionGroups: SuggestionSection[]
) {
  if (!previousSuggestionGroups) {
    return true;
  }

  if (previousSuggestionGroups === nextSuggestionGroups) {
    return false;
  }

  if (previousSuggestionGroups.length !== nextSuggestionGroups.length) {
    return true;
  }

  return !previousSuggestionGroups.every((previousGroup, index) => {
    const nextGroup = nextSuggestionGroups[index];

    return (
      previousGroup.sectionText === nextGroup?.sectionText &&
      previousGroup.suggestions.length === nextGroup?.suggestions.length &&
      previousGroup.suggestions.every(
        (suggestion, suggestionIndex) =>
          suggestion.value === nextGroup?.suggestions[suggestionIndex]?.value
      )
    );
  });
}

function frozenOrderAffectsVisibleValuesChanged(
  frozenOrder: FrozenSuggestionOrder | null,
  suggestionGroups: SuggestionSection[],
  selectedValues: Array<{selected: boolean; value: string}>
) {
  if (!frozenOrder) {
    return false;
  }

  const visibleValues = new Set([
    ...selectedValues.map(selectedValue => selectedValue.value),
    ...suggestionGroups.flatMap(group =>
      group.suggestions.map(suggestion => suggestion.value)
    ),
  ]);
  const frozenValues = new Set(frozenOrder.flatMap(section => section.values));

  if (visibleValues.size !== frozenValues.size) {
    return true;
  }

  return [...visibleValues].some(value => !frozenValues.has(value));
}

// In multi-select mode we want selected values to move to the top when the
// menu opens, but we do not want the list order to keep changing after each
// checkbox toggle because that resets scroll position.
export function useFrozenSuggestionSectionItems({
  createItem,
  selectedValues,
  suggestionGroups,
}: Props) {
  // Read the latest selected values without making checkbox toggles invalidate
  // the frozen ordering calculation on every render.
  const selectedValuesRef = useRef(selectedValues);
  selectedValuesRef.current = selectedValues;

  const previousSuggestionGroupsRef = useRef<SuggestionSection[] | null>(null);
  const frozenOrderRef = useRef<FrozenSuggestionOrder | null>(null);
  const [frozenVersion, setFrozenVersion] = useState(0);

  // Predefined suggestions can rebuild equivalent arrays when the token text
  // changes, so only reset when the visible suggestion contents actually do or
  // when selected custom values enter or leave the visible set.
  if (
    suggestionGroupsAffectOrderChanged(
      previousSuggestionGroupsRef.current,
      suggestionGroups
    ) ||
    frozenOrderAffectsVisibleValuesChanged(
      frozenOrderRef.current,
      suggestionGroups,
      selectedValues
    )
  ) {
    previousSuggestionGroupsRef.current = suggestionGroups;
    frozenOrderRef.current = null;
    setFrozenVersion(v => v + 1);
  }

  return useMemo<SuggestionSectionItem[]>(() => {
    const currentSelectedValues = selectedValuesRef.current;
    const selectedValueSet = new Set(
      currentSelectedValues.map(selectedValue => selectedValue.value)
    );
    const allSuggestions = new Map(
      suggestionGroups.flatMap(group =>
        group.suggestions.map(suggestion => [suggestion.value, suggestion] as const)
      )
    );

    if (!frozenOrderRef.current) {
      const unsectionedSuggestions = suggestionGroups
        .filter(group => group.sectionText === '')
        .flatMap(group => group.suggestions)
        .filter(suggestion => !selectedValueSet.has(suggestion.value));
      const sections = suggestionGroups.filter(group => group.sectionText !== '');

      const nextSuggestionSectionItems: SuggestionSectionItem[] = [
        {
          sectionText: '',
          items: getItemsWithKeys([
            ...currentSelectedValues.map(selectedValue => {
              const matchingSuggestion = allSuggestions.get(selectedValue.value);
              return createItem(matchingSuggestion ?? {value: selectedValue.value});
            }),
            ...unsectionedSuggestions.map(suggestion => createItem(suggestion)),
          ]),
        },
        ...sections.map(group => ({
          sectionText: group.sectionText,
          items: getItemsWithKeys(
            group.suggestions
              .filter(suggestion => !selectedValueSet.has(suggestion.value))
              .map(suggestion => createItem(suggestion))
          ),
        })),
      ];

      frozenOrderRef.current = nextSuggestionSectionItems.map(section => ({
        sectionText: section.sectionText,
        values: section.items.map(item => item.value),
      }));

      return nextSuggestionSectionItems;
    }

    return frozenOrderRef.current.map(section => ({
      sectionText: section.sectionText,
      items: getItemsWithKeys(
        section.values.map(value => {
          const suggestion = allSuggestions.get(value) ?? {value};
          return createItem(suggestion);
        })
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frozenVersion forces recomputation when the render-time check resets frozenOrderRef
  }, [createItem, suggestionGroups, frozenVersion]);
}
