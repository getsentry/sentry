import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {
  DISPLAY_OPTION,
  useNativeDisplayOptionsContext,
  type NativeFrameDetail,
} from 'sentry/components/stackTrace/displayOptionsContext';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

/**
 * The Display dropdown plus native frame detail toggles. Each toggle is
 * disabled when no frame in the stack would change.
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
  const {view} = useStackTraceViewState();
  const {absoluteAddresses, absoluteFilePaths, setFrameDetail, verboseFunctionNames} =
    useNativeDisplayOptionsContext();
  const isRawView = view === 'raw';

  const frameDetails: Array<{
    available: boolean;
    enabled: boolean;
    label: string;
    unavailableTooltip: string;
    value: NativeFrameDetail;
  }> = [
    {
      value: DISPLAY_OPTION.ABSOLUTE_ADDRESSES,
      label: t('Absolute Addresses'),
      available: hasAbsoluteAddresses,
      enabled: absoluteAddresses,
      unavailableTooltip: t('No frames have an instruction address'),
    },
    {
      value: DISPLAY_OPTION.ABSOLUTE_FILE_PATHS,
      label: t('Absolute File Paths'),
      available: hasAbsoluteFilePaths,
      enabled: absoluteFilePaths,
      unavailableTooltip: t(
        'No frames have an absolute path that differs from the filename'
      ),
    },
    {
      value: DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES,
      label: t('Verbose Function Names'),
      available: hasVerboseFunctionNames,
      enabled: verboseFunctionNames,
      unavailableTooltip: t(
        'No frames have a mangled symbol that differs from the demangled name'
      ),
    },
  ];

  return (
    <DisplayOptions
      frameDetails={{
        options: frameDetails.map(detail => ({
          label: detail.label,
          value: detail.value,
          disabled: isRawView || !detail.available,
          tooltip: isRawView
            ? t('Not available on raw stack trace')
            : detail.available
              ? undefined
              : detail.unavailableTooltip,
        })),
        value: isRawView
          ? []
          : frameDetails
              .filter(detail => detail.available && detail.enabled)
              .map(detail => detail.value),
        onChange: values => {
          if (isRawView) {
            return;
          }
          for (const detail of frameDetails) {
            if (detail.available) {
              setFrameDetail(detail.value, values.includes(detail.value));
            }
          }
        },
      }}
    />
  );
}
