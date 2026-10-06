import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

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
        label={t('Sort')}
        closeOnSelect={false}
        value={currentSortVal}
        onChange={opt => setIsNewestFirst(opt.value === 'newest')}
        options={[
          {label: t('Newest'), value: 'newest'},
          {label: t('Oldest'), value: 'oldest'},
        ]}
      />
      <CompositeSelect.Region
        label={t('Display')}
        multiple
        value={isMinified ? ['minified'] : []}
        onChange={opts => setIsMinified(opts.some(opt => opt.value === 'minified'))}
        options={[
          {
            label: minifiedLabel,
            value: 'minified',
            disabled: !hasMinifiedStacktrace,
            tooltip: hasMinifiedStacktrace ? undefined : minifiedUnavailableTooltip,
          },
        ]}
      />
    </CompositeSelect>
  );
}
