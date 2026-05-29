import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

import {NATIVE_DISPLAY_OPTION} from './nativeDisplayOptionsPersistence';
import {useNativeStackTraceContext} from './nativeStackTraceContext';

const VIEW_OPTION_VALUES = [
  'most-relevant',
  'full-stack-trace',
  'raw-stack-trace',
] as const;
const SORT_OPTION_VALUES = ['newest', 'oldest'] as const;

/**
 * Native flavor of the Display dropdown. Drop-in replacement for the generic
 * `DisplayOptions`: same stack trace view and order controls, plus frame
 * detail toggles for symbolication and native-specific frame fields.
 *
 * Native frame detail options auto-disable when no frame in the stack would
 * benefit from them.
 */
export function NativeDisplayOptions() {
  const {
    view,
    setView,
    hasMinifiedStacktrace,
    isMinified,
    setIsMinified,
    isNewestFirst,
    setIsNewestFirst,
    platform,
  } = useStackTraceViewState();
  const {
    absoluteAddresses,
    absoluteFilePaths,
    hasAbsoluteAddresses,
    hasAbsoluteFilePaths,
    hasVerboseFunctionNames,
    persistDisplayOptions,
    setAbsoluteAddresses,
    setAbsoluteFilePaths,
    setVerboseFunctionNames,
    verboseFunctionNames,
  } = useNativeStackTraceContext();

  const isJavaScriptPlatform =
    platform?.startsWith('javascript') || platform?.startsWith('node');
  const minifiedLabel = isJavaScriptPlatform ? t('Minified') : t('Unsymbolicated');
  const minifiedUnavailableTooltip = isJavaScriptPlatform
    ? t('Minified version not available')
    : t('Unsymbolicated version not available');

  const currentViewVal =
    view === 'raw'
      ? 'raw-stack-trace'
      : view === 'full'
        ? 'full-stack-trace'
        : 'most-relevant';
  const currentSortVal = isNewestFirst ? 'newest' : 'oldest';
  const isRawView = view === 'raw';

  const value = [
    currentViewVal,
    currentSortVal,
    ...(isMinified ? [NATIVE_DISPLAY_OPTION.MINIFIED] : []),
    ...(absoluteAddresses && hasAbsoluteAddresses && !isRawView
      ? [NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES]
      : []),
    ...(absoluteFilePaths && hasAbsoluteFilePaths && !isRawView
      ? [NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS]
      : []),
    ...(verboseFunctionNames && hasVerboseFunctionNames && !isRawView
      ? [NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES]
      : []),
  ];

  function handleChange(opts: Array<{value: string}>) {
    const vals = opts.map(o => o.value);

    // Mutually exclusive view selection: pick the newly added view option.
    const newViewVals = vals.filter(v =>
      VIEW_OPTION_VALUES.includes(v as (typeof VIEW_OPTION_VALUES)[number])
    );
    const newViewVal =
      newViewVals.find(v => v !== currentViewVal) ?? newViewVals[0] ?? currentViewVal;
    const nextView =
      newViewVal === 'raw-stack-trace'
        ? ('raw' as const)
        : newViewVal === 'full-stack-trace'
          ? ('full' as const)
          : ('app' as const);

    setView(nextView);

    // Mutually exclusive sort selection.
    const newSortVals = vals.filter(v =>
      SORT_OPTION_VALUES.includes(v as (typeof SORT_OPTION_VALUES)[number])
    );
    const newSortVal =
      newSortVals.find(v => v !== currentSortVal) ?? newSortVals[0] ?? currentSortVal;
    setIsNewestFirst(newSortVal === 'newest');

    const nextIsMinified = vals.includes(NATIVE_DISPLAY_OPTION.MINIFIED);
    let nextAbsoluteAddresses = absoluteAddresses;
    let nextAbsoluteFilePaths = absoluteFilePaths;
    let nextVerboseFunctionNames = verboseFunctionNames;

    setIsMinified(nextIsMinified);
    if (!isRawView && nextView !== 'raw') {
      nextAbsoluteAddresses = vals.includes(NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES);
      nextAbsoluteFilePaths = vals.includes(NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS);
      nextVerboseFunctionNames = vals.includes(
        NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES
      );
      setAbsoluteAddresses(nextAbsoluteAddresses);
      setAbsoluteFilePaths(nextAbsoluteFilePaths);
      setVerboseFunctionNames(nextVerboseFunctionNames);
    }

    persistDisplayOptions({
      absoluteAddresses: nextAbsoluteAddresses,
      absoluteFilePaths: nextAbsoluteFilePaths,
      isMinified: nextIsMinified,
      verboseFunctionNames: nextVerboseFunctionNames,
      view: nextView,
    });
  }

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          size="xs"
          icon={<IconSettings />}
          aria-label={t('Display options')}
        >
          {t('Display')}
        </OverlayTrigger.Button>
      )}
      multiple
      position="bottom-end"
      value={value}
      onChange={handleChange}
      options={[
        {
          label: t('View'),
          options: [
            {label: t('Most Relevant'), value: 'most-relevant'},
            {label: t('Full Stack Trace'), value: 'full-stack-trace'},
            {label: t('Raw Stack Trace'), value: 'raw-stack-trace'},
          ],
        },
        {
          label: t('Order'),
          options: [
            {label: t('Newest First'), value: 'newest'},
            {label: t('Oldest First'), value: 'oldest'},
          ],
        },
        {
          label: t('Frame Details'),
          options: [
            {
              label: minifiedLabel,
              value: NATIVE_DISPLAY_OPTION.MINIFIED,
              disabled: !hasMinifiedStacktrace,
              tooltip: hasMinifiedStacktrace ? undefined : minifiedUnavailableTooltip,
            },
            {
              label: t('Absolute Addresses'),
              value: NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES,
              disabled: isRawView || !hasAbsoluteAddresses,
              tooltip: isRawView
                ? t('Not available on raw stack trace')
                : hasAbsoluteAddresses
                  ? undefined
                  : t('No frames have an instruction address'),
            },
            {
              label: t('Absolute File Paths'),
              value: NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS,
              disabled: isRawView || !hasAbsoluteFilePaths,
              tooltip: isRawView
                ? t('Not available on raw stack trace')
                : hasAbsoluteFilePaths
                  ? undefined
                  : t('No frames have an absolute path that differs from the filename'),
            },
            {
              label: t('Verbose Function Names'),
              value: NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES,
              disabled: isRawView || !hasVerboseFunctionNames,
              tooltip: isRawView
                ? t('Not available on raw stack trace')
                : hasVerboseFunctionNames
                  ? undefined
                  : t(
                      'No frames have a mangled symbol that differs from the demangled name'
                    ),
            },
          ],
        },
      ]}
    />
  );
}
