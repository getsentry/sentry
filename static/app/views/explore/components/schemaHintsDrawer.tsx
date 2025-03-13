import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Tag as Badge} from 'sentry/components/core/badge/tag';
import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {prettifyTagKey} from 'sentry/utils/discover/fields';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useExploreQuery} from 'sentry/views/explore/contexts/pageParamsContext';

type SchemaHintsDrawerProps = {
  hints: Tag[];
};

function SchemaHintsDrawer({hints}: SchemaHintsDrawerProps) {
  const exploreQuery = useExploreQuery();

  const selectedFilterKeys = useMemo(() => {
    const filterQuery = new MutableSearch(exploreQuery);
    return filterQuery.getFilterKeys();
  }, [exploreQuery]);

  const sortedHints = useMemo(() => {
    return hints.toSorted((a, b) => {
      // may need to fix this if we don't want to ignore the prefix
      const aWithoutPrefix = prettifyTagKey(a.key).replace(/^_/, '');
      const bWithoutPrefix = prettifyTagKey(b.key).replace(/^_/, '');
      return aWithoutPrefix.localeCompare(bWithoutPrefix);
    });
  }, [hints]);

  return (
    <Fragment>
      <DrawerHeader hideBar />
      <DrawerBody>
        <HeaderContainer>
          <SchemaHintsHeader>{t('Filter Attributes')}</SchemaHintsHeader>
          <IconSearch size="md" />
        </HeaderContainer>
        <StyledMultipleCheckbox name={t('Filter keys')} value={selectedFilterKeys}>
          {sortedHints.map(hint => (
            <StyledMultipleCheckboxItem key={hint.key} value={hint.key}>
              <CheckboxLabelContainer>
                <CheckboxLabel>{prettifyTagKey(hint.key)}</CheckboxLabel>
                <Badge>
                  {hint.kind === FieldKind.MEASUREMENT ? t('number') : t('string')}
                </Badge>
              </CheckboxLabelContainer>
            </StyledMultipleCheckboxItem>
          ))}
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
  padding-right: ${space(0.5)};
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
  padding: ${space(1)} 0;
  border-top: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
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
