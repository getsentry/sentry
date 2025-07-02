import {useCallback, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Badge} from 'sentry/components/core/badge';
import DropdownButton from 'sentry/components/dropdownButton';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trimSlug} from 'sentry/utils/string/trimSlug';

// TODO: have these come from the API
const PLACEHOLDER_TEST_SUITES = [
  'option 1',
  'option 2',
  'option 3',
  'super-long-option-4',
];

const TEST_SUITE = 'testSuite';

export function TestSuiteDropdown() {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleChange = useCallback(
    (newTestSuites: string[]) => {
      searchParams.delete(TEST_SUITE);

      newTestSuites.forEach(suite => {
        searchParams.append(TEST_SUITE, suite);
      });

      setSearchParams(searchParams);
    },
    [searchParams, setSearchParams]
  );

  const options = useMemo(
    () =>
      PLACEHOLDER_TEST_SUITES.map(suite => ({
        value: suite,
        label: suite,
      })),
    []
  );

  /**
   * Validated values that only includes the currently available test suites
   */
  const value = useMemo(() => {
    const urlTestSuites = searchParams.getAll(TEST_SUITE);
    return urlTestSuites.filter(suite => PLACEHOLDER_TEST_SUITES.includes(suite));
  }, [searchParams]);

  return (
    <HybridFilter
      checkboxPosition="leading"
      searchable
      multiple
      options={options}
      value={value}
      defaultValue={[]}
      onChange={handleChange}
      // TODO: Add the disabled and emptyMessage when connected to backend hook
      menuTitle={t('Filter Test Suites')}
      menuWidth={'22em'}
      trigger={triggerProps => {
        const areAllSuitesSelected =
          value.length === 0 ||
          PLACEHOLDER_TEST_SUITES.every(suite => value.includes(suite));
        // Show 2 suites only if the combined string's length does not exceed 22.
        // Otherwise show only 1 test suite.
        const suitesToShow =
          value[0]?.length! + value[1]?.length! < 22
            ? value.slice(0, 2)
            : value.slice(0, 1);
        const enumeratedLabel = suitesToShow.map(env => trimSlug(env, 22)).join(', ');

        const label = areAllSuitesSelected ? t('All Test Suites') : enumeratedLabel;
        const remainingCount = areAllSuitesSelected
          ? 0
          : value.length - suitesToShow.length;

        return (
          <DropdownButton {...triggerProps}>
            <TriggerLabelWrap>
              <TriggerLabel>{label}</TriggerLabel>
            </TriggerLabelWrap>
            {remainingCount > 0 && (
              <StyledBadge type="default">{`+${remainingCount}`}</StyledBadge>
            )}
          </DropdownButton>
        );
      }}
    />
  );
}

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;

const StyledBadge = styled(Badge)`
  margin-top: -${space(0.5)};
  margin-bottom: -${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
