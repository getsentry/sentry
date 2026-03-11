import {useCallback, useMemo, useRef} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';
import xor from 'lodash/xor';

import {Badge} from '@sentry/scraps/badge';
import {Checkbox} from '@sentry/scraps/checkbox';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useStagedCompactSelect} from 'sentry/components/pageFilters/useStagedCompactSelect';
import {useTestSuites} from 'sentry/components/prevent/testSuiteDropdown/useTestSuites';
import {t} from 'sentry/locale';
import {trimSlug} from 'sentry/utils/string/trimSlug';

const TEST_SUITES = 'testSuites';
const MAX_SUITE_UI_LENGTH = 50;

export function TestSuiteDropdown() {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const {data: testSuites} = useTestSuites();

  // Ref to break the circular dependency: options need toggleOption, but toggleOption
  // comes from useStagedCompactSelect which depends on options.
  const toggleOptionRef = useRef<((val: string) => void) | undefined>(undefined);

  const handleChange = useCallback(
    (newTestSuites: string[]) => {
      urlSearchParams.delete(TEST_SUITES);

      newTestSuites.forEach(suite => {
        urlSearchParams.append(TEST_SUITES, suite);
      });

      setUrlSearchParams(urlSearchParams);
    },
    [urlSearchParams, setUrlSearchParams]
  );

  const options = useMemo(() => {
    const selectedNames = urlSearchParams.getAll(TEST_SUITES);
    const selectedSet = new Set(selectedNames.map(name => name.toLowerCase()));

    const mapped = testSuites.map(suite => ({
      label: suite,
      value: suite,
      isSelected: selectedSet.has(suite.toLowerCase()),
      leadingItems: ({isSelected}: {isSelected: boolean}) => (
        <Checkbox
          checked={isSelected}
          onChange={() => toggleOptionRef.current?.(suite)}
          aria-label={t('Select %s', suite)}
          tabIndex={-1}
        />
      ),
    }));

    return sortBy(mapped, [option => !option.isSelected]);
  }, [testSuites, urlSearchParams]);

  function getEmptyMessage() {
    if (!options.length) {
      return t('No test suites found');
    }
    return undefined;
  }

  /**
   * Validated values that only includes the currently available test suites
   */
  const value = useMemo(() => {
    const urlTestSuites = urlSearchParams.getAll(TEST_SUITES);
    return urlTestSuites.filter(suite => testSuites?.includes(suite));
  }, [urlSearchParams, testSuites]);

  const stagedSelect = useStagedCompactSelect({
    value,
    options,
    onChange: handleChange,
    multiple: true,
  });

  // Wire up toggleOptionRef after stagedSelect is created to break the circular
  // dependency between options (which need toggleOption) and useStagedCompactSelect
  // (which needs options).
  toggleOptionRef.current = stagedSelect.toggleOption;

  const {dispatch} = stagedSelect;
  const hasStagedChanges = xor(stagedSelect.value, value).length > 0;
  const shouldShowReset = stagedSelect.value.length > 0;

  return (
    <CompactSelect
      grid
      multiple
      {...stagedSelect.compactSelectProps}
      emptyMessage={getEmptyMessage()}
      menuTitle={t('Filter Test Suites')}
      menuHeaderTrailingItems={
        shouldShowReset ? (
          <MenuComponents.ResetButton
            onClick={() => {
              dispatch({type: 'remove staged'});
              handleChange([]);
            }}
          />
        ) : null
      }
      menuFooter={
        hasStagedChanges ? (
          <Flex gap="md" align="center" justify="end">
            <MenuComponents.CancelButton
              onClick={() => dispatch({type: 'remove staged'})}
            />
            <MenuComponents.ApplyButton
              onClick={() => {
                dispatch({type: 'remove staged'});
                handleChange(stagedSelect.value);
              }}
            />
          </Flex>
        ) : null
      }
      trigger={triggerProps => {
        const areAllSuitesSelected =
          value.length === 0 || testSuites?.every(suite => value.includes(suite));
        // Show 2 suites only if the combined string's length does not exceed MAX_SUITE_UI_LENGTH.
        // Otherwise show only 1 test suite.
        const totalLength =
          (value[0]?.length ?? 0) + (value[1]?.length ?? 0) + (value[1] ? 2 : 0);
        const suitesToShow =
          totalLength <= MAX_SUITE_UI_LENGTH ? value.slice(0, 2) : value.slice(0, 1);
        const enumeratedLabel = suitesToShow
          .map(env => trimSlug(env, MAX_SUITE_UI_LENGTH))
          .join(', ');

        const label = areAllSuitesSelected ? t('All Test Suites') : enumeratedLabel;
        const remainingCount = areAllSuitesSelected
          ? 0
          : value.length - suitesToShow.length;

        return (
          <OverlayTrigger.Button {...triggerProps}>
            <Container as="span" minWidth="0" position="relative">
              <TriggerLabel>{label}</TriggerLabel>
            </Container>
            {remainingCount > 0 && (
              <StyledBadge variant="muted">{`+${remainingCount}`}</StyledBadge>
            )}
          </OverlayTrigger.Button>
        );
      }}
    />
  );
}

const TriggerLabel = styled('span')`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;
`;

const StyledBadge = styled(Badge)`
  margin-top: -${p => p.theme.space.xs};
  margin-bottom: -${p => p.theme.space.xs};
  margin-left: ${p => p.theme.space.xs};
  flex-shrink: 0;
  top: auto;
`;
