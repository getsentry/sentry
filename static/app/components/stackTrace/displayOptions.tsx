import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

const VIEW_OPTION_VALUES = [
  'most-relevant',
  'full-stack-trace',
  'raw-stack-trace',
] as const;
const SORT_OPTION_VALUES = ['newest', 'oldest'] as const;

/**
 * A single dropdown that consolidates view, sort, and display toggles.
 */
export function DisplayOptions() {
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

  const value = [currentViewVal, currentSortVal, ...(isMinified ? ['minified'] : [])];

  function handleChange(opts: Array<{value: string}>) {
    const vals = opts.map(o => o.value);

    // Mutually exclusive view selection: pick the newly added view option
    const newViewVals = vals.filter(v =>
      VIEW_OPTION_VALUES.includes(v as (typeof VIEW_OPTION_VALUES)[number])
    );
    const newViewVal =
      newViewVals.find(v => v !== currentViewVal) ?? newViewVals[0] ?? currentViewVal;
    if (newViewVal === 'raw-stack-trace') {
      setView('raw');
    } else if (newViewVal === 'full-stack-trace') {
      setView('full');
    } else {
      setView('app');
    }

    // Mutually exclusive sort selection: pick the newly added sort option
    const newSortVals = vals.filter(v =>
      SORT_OPTION_VALUES.includes(v as (typeof SORT_OPTION_VALUES)[number])
    );
    const newSortVal =
      newSortVals.find(v => v !== currentSortVal) ?? newSortVals[0] ?? currentSortVal;
    setIsNewestFirst(newSortVal === 'newest');

    setIsMinified(vals.includes('minified'));
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
          label: t('Sort'),
          options: [
            {label: t('Newest'), value: 'newest'},
            {label: t('Oldest'), value: 'oldest'},
          ],
        },
        {
          label: t('Display'),
          options: [
            {
              label: minifiedLabel,
              value: 'minified',
              disabled: !hasMinifiedStacktrace,
              tooltip: hasMinifiedStacktrace ? undefined : minifiedUnavailableTooltip,
            },
          ],
        },
      ]}
    />
  );
}
