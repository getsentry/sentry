import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Tooltip} from 'sentry/components/core/tooltip';
import displayRawContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {useStacktraceContext} from 'sentry/components/events/interfaces/stackTraceContext';
import {IconCopy, IconEllipsis, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isMobilePlatform, isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

const sortByOptions = {
  'recent-first': t('Newest'),
  'recent-last': t('Oldest'),
};

export const stackTraceDisplayOptionLabels = {
  'absolute-addresses': t('Absolute addresses'),
  'absolute-file-paths': t('Absolute file paths'),
  minified: t('Unsymbolicated'),
  'raw-stack-trace': t('Raw stack trace'),
  'verbose-function-names': t('Verbose function names'),
};

type Props = {
  children: React.ReactNode;
  event: Event;
  eventId: Event['id'];
  hasAbsoluteAddresses: boolean;
  hasAbsoluteFilePaths: boolean;
  hasMinified: boolean;
  hasNewestFirst: boolean;
  hasVerboseFunctionNames: boolean;
  platform: PlatformKey;
  projectSlug: Project['slug'];
  stackTraceNotFound: boolean;
  title: React.ReactNode;
  type: string;
  activeThreadId?: number;
  isNestedSection?: boolean;
};

export function TraceEventDataSection({
  type,
  title,
  stackTraceNotFound,
  children,
  platform,
  projectSlug,
  event,
  eventId,
  hasNewestFirst,
  hasMinified,
  hasVerboseFunctionNames,
  hasAbsoluteFilePaths,
  hasAbsoluteAddresses,
  isNestedSection = false,
  activeThreadId,
}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const {copy} = useCopyToClipboard();

  const {
    displayOptions,
    isNewestFramesFirst,
    isFullStackTrace,
    forceFullStackTrace,
    setDisplayOptions,
    setIsNewestFramesFirst,
    setIsFullStackTrace,
  } = useStacktraceContext();

  const isMobile = isMobilePlatform(platform);

  const handleFilterFramesChange = useCallback(
    (val: 'full' | 'relevant') => {
      const isFullOptionClicked = val === 'full';

      trackAnalytics(
        isFullOptionClicked
          ? 'stack-trace.full_stack_trace_clicked'
          : 'stack-trace.most_relevant_clicked',
        {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
        }
      );

      setIsFullStackTrace(isFullOptionClicked);
    },
    [organization, platform, projectSlug, isMobile, setIsFullStackTrace]
  );

  const handleSortByChange = useCallback(
    (val: keyof typeof sortByOptions) => {
      const isRecentFirst = val === 'recent-first';

      trackAnalytics(
        isRecentFirst
          ? 'stack-trace.sort_option_recent_first_clicked'
          : 'stack-trace.sort_option_recent_last_clicked',
        {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
        }
      );

      setIsNewestFramesFirst(isRecentFirst);
    },
    [organization, platform, projectSlug, isMobile, setIsNewestFramesFirst]
  );

  const handleDisplayChange = useCallback(
    (vals: typeof displayOptions) => {
      if (vals.includes('raw-stack-trace')) {
        trackAnalytics('stack-trace.display_option_raw_stack_trace_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: true,
        });
      } else if (displayOptions.includes('raw-stack-trace')) {
        trackAnalytics('stack-trace.display_option_raw_stack_trace_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: false,
        });
      }

      if (vals.includes('absolute-addresses')) {
        trackAnalytics('stack-trace.display_option_absolute_addresses_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: true,
        });
      } else if (displayOptions.includes('absolute-addresses')) {
        trackAnalytics('stack-trace.display_option_absolute_addresses_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: false,
        });
      }

      if (vals.includes('absolute-file-paths')) {
        trackAnalytics('stack-trace.display_option_absolute_file_paths_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: true,
        });
      } else if (displayOptions.includes('absolute-file-paths')) {
        trackAnalytics('stack-trace.display_option_absolute_file_paths_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: false,
        });
      }

      if (vals.includes('minified')) {
        trackAnalytics(
          platform.startsWith('javascript')
            ? 'stack-trace.display_option_minified_clicked'
            : 'stack-trace.display_option_unsymbolicated_clicked',
          {
            organization,
            project_slug: projectSlug,
            platform,
            is_mobile: isMobile,
            checked: true,
          }
        );
      } else if (displayOptions.includes('minified')) {
        trackAnalytics(
          platform.startsWith('javascript')
            ? 'stack-trace.display_option_minified_clicked'
            : 'stack-trace.display_option_unsymbolicated_clicked',
          {
            organization,
            project_slug: projectSlug,
            platform,
            is_mobile: isMobile,
            checked: false,
          }
        );
      }

      if (vals.includes('verbose-function-names')) {
        trackAnalytics('stack-trace.display_option_verbose_function_names_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: true,
        });
      } else if (displayOptions.includes('verbose-function-names')) {
        trackAnalytics('stack-trace.display_option_verbose_function_names_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: false,
        });
      }

      setDisplayOptions(vals);
    },
    [organization, platform, projectSlug, isMobile, displayOptions, setDisplayOptions]
  );

  const handleCopyRawStacktrace = useCallback(() => {
    trackAnalytics('stack-trace.copy_raw_clicked', {
      organization,
      project_slug: projectSlug,
      platform,
      is_mobile: isMobile,
    });

    const useMinified = displayOptions.includes('minified');

    const stacktraceEntries = event.entries.filter(
      entry =>
        entry.type === EntryType.EXCEPTION ||
        entry.type === EntryType.STACKTRACE ||
        entry.type === EntryType.THREADS
    );

    const rawStacktraces = stacktraceEntries.map(entry => {
      if (entry.type === EntryType.EXCEPTION) {
        return (
          entry.data.values
            ?.map(exception => {
              const stacktraceData = useMinified
                ? (exception.rawStacktrace ?? exception.stacktrace)
                : exception.stacktrace;
              return displayRawContent({
                data: stacktraceData,
                platform: stacktraceData?.frames?.[0]?.platform ?? platform,
                exception,
                hasSimilarityEmbeddingsFeature: false,
                includeLocation: true,
                rawTrace: true,
                isMinified: useMinified,
              });
            })
            .filter(Boolean)
            .join('\n\n') ?? ''
        );
      }
      if (entry.type === EntryType.STACKTRACE) {
        return displayRawContent({
          data: entry.data,
          platform: entry.data.frames?.[0]?.platform ?? platform,
          hasSimilarityEmbeddingsFeature: false,
          includeLocation: true,
          rawTrace: true,
          isMinified: useMinified,
        });
      }
      if (entry.type === EntryType.THREADS) {
        const activeThread = entry.data.values?.find(
          thread => thread.id === activeThreadId
        );
        if (activeThread) {
          const stacktraceData = useMinified
            ? (activeThread.rawStacktrace ?? activeThread.stacktrace)
            : activeThread.stacktrace;
          if (stacktraceData) {
            const threadInfo = activeThread.name ? `Thread: ${activeThread.name}\n` : '';
            return (
              threadInfo +
              displayRawContent({
                data: stacktraceData,
                platform: stacktraceData.frames?.[0]?.platform ?? platform,
                hasSimilarityEmbeddingsFeature: false,
                includeLocation: true,
                rawTrace: true,
                isMinified: useMinified,
              })
            );
          }
        }
        return '';
      }
      return '';
    });

    const formattedStacktrace = rawStacktraces.filter(Boolean).join('\n\n');
    copy(formattedStacktrace);
  }, [
    event,
    platform,
    organization,
    projectSlug,
    isMobile,
    copy,
    activeThreadId,
    displayOptions,
  ]);

  function getDisplayOptions(): Array<{
    label: string;
    value: (typeof displayOptions)[number];
    disabled?: boolean;
    tooltip?: string;
  }> {
    if (
      platform === 'objc' ||
      platform === 'native' ||
      platform === 'cocoa' ||
      platform === 'nintendo-switch' ||
      platform === 'playstation' ||
      platform === 'xbox'
    ) {
      return [
        {
          label: stackTraceDisplayOptionLabels['absolute-addresses'],
          value: 'absolute-addresses',
          disabled: displayOptions.includes('raw-stack-trace') || !hasAbsoluteAddresses,
          tooltip: displayOptions.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : hasAbsoluteAddresses
              ? undefined
              : t('Absolute addresses not available'),
        },
        {
          label: stackTraceDisplayOptionLabels['absolute-file-paths'],
          value: 'absolute-file-paths',
          disabled: displayOptions.includes('raw-stack-trace') || !hasAbsoluteFilePaths,
          tooltip: displayOptions.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : hasAbsoluteFilePaths
              ? undefined
              : t('Absolute file paths not available'),
        },
        {
          label: stackTraceDisplayOptionLabels.minified,
          value: 'minified',
          disabled: !hasMinified,
          tooltip: hasMinified ? undefined : t('Unsymbolicated version not available'),
        },
        {
          label: stackTraceDisplayOptionLabels['raw-stack-trace'],
          value: 'raw-stack-trace',
        },
        {
          label: stackTraceDisplayOptionLabels['verbose-function-names'],
          value: 'verbose-function-names',
          disabled:
            displayOptions.includes('raw-stack-trace') || !hasVerboseFunctionNames,
          tooltip: displayOptions.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : hasVerboseFunctionNames
              ? undefined
              : t('Verbose function names not available'),
        },
      ];
    }

    if (platform.startsWith('python')) {
      return [
        {
          label: stackTraceDisplayOptionLabels['raw-stack-trace'],
          value: 'raw-stack-trace',
        },
      ];
    }

    // This logic might be incomplete, but according to the SDK folks, this is 99.9% of the cases
    if (platform.startsWith('javascript') || platform.startsWith('node')) {
      return [
        {
          label: t('Minified'),
          value: 'minified',
          disabled: !hasMinified,
          tooltip: hasMinified ? undefined : t('Minified version not available'),
        },
        {
          label: stackTraceDisplayOptionLabels['raw-stack-trace'],
          value: 'raw-stack-trace',
        },
      ];
    }

    return [
      {
        label: stackTraceDisplayOptionLabels.minified,
        value: 'minified',
        disabled: !hasMinified,
        tooltip: hasMinified ? undefined : t('Minified version not available'),
      },
      {
        label: stackTraceDisplayOptionLabels['raw-stack-trace'],
        value: 'raw-stack-trace',
      },
    ];
  }

  const nativePlatform = isNativePlatform(platform);
  const minified = displayOptions.includes('minified');

  // Apple crash report endpoint
  const appleCrashEndpoint = `/projects/${organization.slug}/${projectSlug}/events/${eventId}/apple-crash-report?minified=${minified}`;
  const rawStackTraceDownloadLink = `${api.baseUrl}${appleCrashEndpoint}&download=1`;

  const sortByTooltip = hasNewestFirst
    ? displayOptions.includes('raw-stack-trace')
      ? t('Not available on raw stack trace')
      : undefined
    : t('Not available on stack trace with single frame');

  const SectionComponent = isNestedSection ? InlineThreadSection : InterimSection;

  const optionsToShow = getDisplayOptions();
  const displayValues = displayOptions.filter(value =>
    optionsToShow.some(opt => opt.value === value && !opt.disabled)
  );

  return (
    <SectionComponent
      type={type}
      showPermalink={!hasStreamlinedUI}
      title={title}
      disableCollapsePersistence
      actions={
        !stackTraceNotFound && (
          <ButtonBar>
            {!displayOptions.includes('raw-stack-trace') && (
              <Tooltip
                title={t('Only full version available')}
                disabled={!forceFullStackTrace}
              >
                <SegmentedControl
                  size="xs"
                  aria-label={t('Filter frames')}
                  value={isFullStackTrace ? 'full' : 'relevant'}
                  onChange={handleFilterFramesChange}
                >
                  <SegmentedControl.Item key="relevant" disabled={forceFullStackTrace}>
                    {t('Most Relevant')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="full">
                    {t('Full Stack Trace')}
                  </SegmentedControl.Item>
                </SegmentedControl>
              </Tooltip>
            )}
            <Button
              size="xs"
              icon={<IconCopy />}
              onClick={handleCopyRawStacktrace}
              aria-label={t('Copy Raw Stacktrace')}
              title={t('Copy raw stacktrace to clipboard')}
            />
            {displayOptions.includes('raw-stack-trace') && nativePlatform && (
              <LinkButton
                size="xs"
                href={rawStackTraceDownloadLink}
                title={t('Download raw stack trace file')}
                onClick={() => {
                  trackAnalytics('stack-trace.download_clicked', {
                    organization,
                    project_slug: projectSlug,
                    platform,
                    is_mobile: isMobile,
                  });
                }}
              >
                {t('Download')}
              </LinkButton>
            )}
            <CompactSelect
              triggerProps={{
                icon: <IconSort />,
                size: 'xs',
                title: sortByTooltip,
              }}
              disabled={!!sortByTooltip}
              position="bottom-end"
              onChange={selectedOption => {
                handleSortByChange(selectedOption.value);
              }}
              value={isNewestFramesFirst ? 'recent-first' : 'recent-last'}
              options={Object.entries(sortByOptions).map(([value, label]) => ({
                label,
                value: value as keyof typeof sortByOptions,
              }))}
            />
            <CompactSelect
              triggerProps={{
                icon: <IconEllipsis />,
                size: 'xs',
                showChevron: false,
                'aria-label': t('Options'),
                children: '',
              }}
              multiple
              position="bottom-end"
              value={displayValues}
              onChange={opts => handleDisplayChange(opts.map(opt => opt.value))}
              options={[{label: t('Display'), options: optionsToShow}]}
            />
          </ButtonBar>
        )
      }
    >
      {children}
    </SectionComponent>
  );
}

function InlineThreadSection({
  children,
  title,
  actions,
}: {
  actions: React.ReactNode;
  children: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <Wrapper>
      <InlineSectionHeaderWrapper>
        <ThreadHeading>{title}</ThreadHeading>
        {actions}
      </InlineSectionHeaderWrapper>
      {children}
    </Wrapper>
  );
}

const Wrapper = styled('div')``;

const ThreadHeading = styled('h3')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
`;

const InlineSectionHeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;
