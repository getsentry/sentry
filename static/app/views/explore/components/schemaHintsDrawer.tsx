import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Tag as Badge} from 'sentry/components/core/badge/tag';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {prettifyTagKey} from 'sentry/utils/discover/fields';
import {FieldKind, FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  useExploreQuery,
  useSetExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';

type SchemaHintsDrawerProps = {
  hints: Tag[];
};

function SchemaHintsDrawer({hints}: SchemaHintsDrawerProps) {
  const exploreQuery = useExploreQuery();
  const setExploreQuery = useSetExploreQuery();

  const selectedFilterKeys = useMemo(() => {
    const filterQuery = new MutableSearch(exploreQuery);
    return filterQuery.getFilterKeys();
  }, [exploreQuery]);

  const sortedSelectedHints = useMemo(() => {
    const sortedKeys = selectedFilterKeys.toSorted((a, b) => {
      return prettifyTagKey(a).localeCompare(prettifyTagKey(b));
    });
    return sortedKeys
      .map(key => hints.find(hint => hint.key === key))
      .filter(tag => !!tag);
  }, [hints, selectedFilterKeys]);

  const sortedHints = useMemo(() => {
    return [
      ...new Set([
        ...sortedSelectedHints,
        ...hints.toSorted((a, b) => {
          // may need to fix this if we don't want to ignore the prefix
          const aWithoutPrefix = prettifyTagKey(a.key).replace(/^_/, '');
          const bWithoutPrefix = prettifyTagKey(b.key).replace(/^_/, '');
          return aWithoutPrefix.localeCompare(bWithoutPrefix);
        }),
      ]),
    ];
  }, [hints, sortedSelectedHints]);

  const handleCheckboxChange = useCallback(
    (hint: Tag) => {
      const filterQuery = new MutableSearch(exploreQuery);
      if (filterQuery.getFilterKeys().includes(hint.key)) {
        filterQuery.removeFilter(hint.key);
      } else {
        const hintFieldDefinition = getFieldDefinition(hint.key, 'span', hint.kind);
        filterQuery.addFilterValue(
          hint.key,
          hintFieldDefinition?.valueType === FieldValueType.BOOLEAN
            ? 'True'
            : hint.kind === FieldKind.MEASUREMENT
              ? '>0'
              : ''
        );
      }
      setExploreQuery(filterQuery.formatString());
    },
    [exploreQuery, setExploreQuery]
  );

  return (
    <Fragment>
      <DrawerHeader hideBar />
      <DrawerBody>
        <HeaderContainer>
          <SchemaHintsHeader>{t('Filter Attributes')}</SchemaHintsHeader>
          <IconSearch size="md" />
        </HeaderContainer>
        <StyledMultipleCheckbox name={t('Filter keys')} value={selectedFilterKeys}>
          {sortedHints.map(hint => {
            const hintFieldDefinition = getFieldDefinition(hint.key, 'span', hint.kind);
            const hintType =
              hintFieldDefinition?.valueType === FieldValueType.BOOLEAN
                ? t('boolean')
                : hint.kind === FieldKind.MEASUREMENT
                  ? t('number')
                  : t('string');
            return (
              <StyledMultipleCheckboxItem
                key={hint.key}
                value={hint.key}
                onChange={() => handleCheckboxChange(hint)}
              >
                <CheckboxLabelContainer>
                  <CheckboxLabel>{prettifyTagKey(hint.key)}</CheckboxLabel>
                  <Badge>{hintType}</Badge>
                </CheckboxLabelContainer>
              </StyledMultipleCheckboxItem>
            );
          })}
        </StyledMultipleCheckbox>
      </DrawerBody>
    </Fragment>
  );
}

export default SchemaHintsDrawer;

const SchemaHintsHeader = styled('h4')`
  margin: 0;
`;

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(2)};
`;

const CheckboxLabelContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: ${space(1)};
  cursor: pointer;
  padding-right: ${space(0.25)};
`;

const CheckboxLabel = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
  margin: 0;
  ${p => p.theme.overflowEllipsis};
`;

const StyledMultipleCheckbox = styled(MultipleCheckbox)`
  flex-direction: column;
`;

const StyledMultipleCheckboxItem = styled(MultipleCheckbox.Item)`
  width: 100%;
  padding: ${space(1)} ${space(0.5)};
  border-top: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
  }

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:active {
    background-color: ${p => p.theme.gray100};
  }

  &:last-child {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  & > label {
    width: 100%;
    margin: 0;
    display: flex;
  }

  & > label > span {
    width: 100%;
    ${p => p.theme.overflowEllipsis};
  }
`;
