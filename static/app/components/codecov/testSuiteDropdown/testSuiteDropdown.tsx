import {useCallback, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {useTestSuites} from 'sentry/components/codecov/testSuiteDropdown/useTestSuites';
import {Badge} from 'sentry/components/core/badge';
import DropdownButton from 'sentry/components/dropdownButton';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trimSlug} from 'sentry/utils/string/trimSlug';

const TEST_SUITES = 'testSuites';
const MAX_SUITE_UI_LENGTH = 22;

export function TestSuiteDropdown() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {data: testSuites} = useTestSuites();

  const handleChange = useCallback(
    (newTestSuites: string[]) => {
      searchParams.delete(TEST_SUITES);

      newTestSuites.forEach(suite => {
        searchParams.append(TEST_SUITES, suite);
      });

      setSearchParams(searchParams);
    },
    [searchParams, setSearchParams]
  );

  const options = useMemo(
    () =>
      testSuites?.map(suite => ({
        value: suite,
        label: suite,
      })),
    [testSuites]
  );

  /**
   * Validated values that only includes the currently available test suites
   */
  const value = useMemo(() => {
    const urlTestSuites = searchParams.getAll(TEST_SUITES);
    return urlTestSuites.filter(suite => testSuites?.includes(suite));
  }, [searchParams, testSuites]);

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
      menuWidth={`${MAX_SUITE_UI_LENGTH}em`}
      trigger={triggerProps => {
        const areAllSuitesSelected =
          value.length === 0 || testSuites?.every(suite => value.includes(suite));
        // Show 2 suites only if the combined string's length does not exceed 22.
        // Otherwise show only 1 test suite.
        const totalLength =
          (value[0]?.length ?? 0) + (value[1]?.length ?? 0) + (value[1] ? 2 : 0);
        const suitesToShow =
          totalLength < MAX_SUITE_UI_LENGTH ? value.slice(0, 2) : value.slice(0, 1);
        const enumeratedLabel = suitesToShow
          .map(env => trimSlug(env, MAX_SUITE_UI_LENGTH))
          .join(', ');

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
  margin-left: ${space(0.5)};
  flex-shrink: 0;
  top: auto;
`;
