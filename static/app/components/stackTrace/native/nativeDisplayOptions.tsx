import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

import {useNativeDisplayOptionsContext} from './nativeDisplayOptionsContext';
import {NATIVE_DISPLAY_OPTION} from './nativeDisplayOptionsPersistence';

/**
 * Native flavor of the Display dropdown. Drop-in replacement for the generic
 * `DisplayOptions`: same stack trace view and order controls, plus frame
 * detail toggles for symbolication and native-specific frame fields.
 *
 * Native frame detail options auto-disable when no frame in the stack would
 * benefit from them.
 */
export function NativeDisplayOptionsMenu({
  hasAbsoluteAddresses,
  hasAbsoluteFilePaths,
  hasVerboseFunctionNames,
}: {
  hasAbsoluteAddresses: boolean;
  hasAbsoluteFilePaths: boolean;
  hasVerboseFunctionNames: boolean;
}) {
  const {
    view,
    setView,
    hasMinifiedStacktrace,
    isMinified,
    isNewestFirst,
    setIsNewestFirst,
    platform,
  } = useStackTraceViewState();
  const {
    absoluteAddresses,
    absoluteFilePaths,
    prefersMinified,
    updateDisplayOptions,
    verboseFunctionNames,
  } = useNativeDisplayOptionsContext();

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

  const frameDetails = [
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

  function handleFrameDetailsChange(opts: Array<{value: string}>) {
    const vals = opts.map(o => o.value);
    const nextPrefersMinified = hasMinifiedStacktrace
      ? vals.includes(NATIVE_DISPLAY_OPTION.MINIFIED)
      : prefersMinified;
    let nextAbsoluteAddresses = absoluteAddresses;
    let nextAbsoluteFilePaths = absoluteFilePaths;
    let nextVerboseFunctionNames = verboseFunctionNames;

    if (!isRawView) {
      nextAbsoluteAddresses = hasAbsoluteAddresses
        ? vals.includes(NATIVE_DISPLAY_OPTION.ABSOLUTE_ADDRESSES)
        : absoluteAddresses;
      nextAbsoluteFilePaths = hasAbsoluteFilePaths
        ? vals.includes(NATIVE_DISPLAY_OPTION.ABSOLUTE_FILE_PATHS)
        : absoluteFilePaths;
      nextVerboseFunctionNames = hasVerboseFunctionNames
        ? vals.includes(NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES)
        : verboseFunctionNames;
    }

    updateDisplayOptions({
      absoluteAddresses: nextAbsoluteAddresses,
      absoluteFilePaths: nextAbsoluteFilePaths,
      isNewestFirst,
      prefersMinified: nextPrefersMinified,
      verboseFunctionNames: nextVerboseFunctionNames,
      view,
    });
  }

  return (
    <CompositeSelect
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
      position="bottom-end"
    >
      <CompositeSelect.Region
        label={t('View')}
        closeOnSelect={false}
        value={currentViewVal}
        onChange={opt => {
          if (opt.value === 'raw-stack-trace') {
            setView('raw');
          } else if (opt.value === 'full-stack-trace') {
            setView('full');
          } else {
            setView('app');
          }
        }}
        options={[
          {label: t('Most Relevant'), value: 'most-relevant'},
          {label: t('Full Stack Trace'), value: 'full-stack-trace'},
          {label: t('Raw Stack Trace'), value: 'raw-stack-trace'},
        ]}
      />
      <CompositeSelect.Region
        label={t('Order')}
        closeOnSelect={false}
        value={currentSortVal}
        onChange={opt => setIsNewestFirst(opt.value === 'newest')}
        options={[
          {label: t('Newest First'), value: 'newest'},
          {label: t('Oldest First'), value: 'oldest'},
        ]}
      />
      <CompositeSelect.Region
        label={t('Frame Details')}
        multiple
        value={frameDetails}
        onChange={handleFrameDetailsChange}
        options={[
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
        ]}
      />
    </CompositeSelect>
  );
}
