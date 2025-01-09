import {createContext, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isMobilePlatform, isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

const sortByOptions = {
  'recent-first': t('Newest'),
  'recent-last': t('Oldest'),
};

export const displayOptions = {
  'absolute-addresses': t('Absolute addresses'),
  'absolute-file-paths': t('Absolute file paths'),
  minified: t('Unsymbolicated'),
  'raw-stack-trace': t('Raw stack trace'),
  'verbose-function-names': t('Verbose function names'),
};

type State = {
  display: Array<keyof typeof displayOptions>;
  fullStackTrace: boolean;
  sortBy: keyof typeof sortByOptions;
};

type ChildProps = Omit<State, 'sortBy'> & {recentFirst: boolean};

type Props = {
  children: (childProps: ChildProps) => React.ReactNode;
  eventId: Event['id'];
  fullStackTrace: boolean;
  hasAbsoluteAddresses: boolean;
  hasAbsoluteFilePaths: boolean;
  hasAppOnlyFrames: boolean;
  hasMinified: boolean;
  hasNewestFirst: boolean;
  hasVerboseFunctionNames: boolean;
  platform: PlatformKey;
  projectSlug: Project['slug'];
  recentFirst: boolean;
  stackTraceNotFound: boolean;
  title: React.ReactNode;
  type: string;
  isNestedSection?: boolean;
};

export const TraceEventDataSectionContext = createContext<ChildProps | undefined>(
  undefined
);

export function TraceEventDataSection({
  type,
  title,
  stackTraceNotFound,
  fullStackTrace,
  recentFirst,
  children,
  platform,
  projectSlug,
  eventId,
  hasNewestFirst,
  hasMinified,
  hasVerboseFunctionNames,
  hasAbsoluteFilePaths,
  hasAbsoluteAddresses,
  hasAppOnlyFrames,
  isNestedSection = false,
}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();

  const [state, setState] = useState<State>({
    sortBy: recentFirst ? 'recent-first' : 'recent-last',
    fullStackTrace: !hasAppOnlyFrames ? true : fullStackTrace,
    display: [],
  });

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

      setState(currentState => ({...currentState, fullStackTrace: isFullOptionClicked}));
    },
    [organization, platform, projectSlug, isMobile]
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

      setState(currentState => ({...currentState, sortBy: val}));
    },
    [organization, platform, projectSlug, isMobile]
  );

  const handleDisplayChange = useCallback(
    (vals: (keyof typeof displayOptions)[]) => {
      if (vals.includes('raw-stack-trace')) {
        trackAnalytics('stack-trace.display_option_raw_stack_trace_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: true,
        });
      } else if (state.display.includes('raw-stack-trace')) {
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
      } else if (state.display.includes('absolute-addresses')) {
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
      } else if (state.display.includes('absolute-file-paths')) {
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
      } else if (state.display.includes('minified')) {
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
      } else if (state.display.includes('verbose-function-names')) {
        trackAnalytics('stack-trace.display_option_verbose_function_names_clicked', {
          organization,
          project_slug: projectSlug,
          platform,
          is_mobile: isMobile,
          checked: false,
        });
      }

      setState(currentState => ({...currentState, display: vals}));
    },
    [organization, platform, projectSlug, isMobile, state]
  );

  function getDisplayOptions(): {
    label: string;
    value: keyof typeof displayOptions;
    disabled?: boolean;
    tooltip?: string;
  }[] {
    if (
      platform === 'objc' ||
      platform === 'native' ||
      platform === 'cocoa' ||
      platform === 'nintendo-switch'
    ) {
      return [
        {
          label: displayOptions['absolute-addresses'],
          value: 'absolute-addresses',
          disabled: state.display.includes('raw-stack-trace') || !hasAbsoluteAddresses,
          tooltip: state.display.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : !hasAbsoluteAddresses
              ? t('Absolute addresses not available')
              : undefined,
        },
        {
          label: displayOptions['absolute-file-paths'],
          value: 'absolute-file-paths',
          disabled: state.display.includes('raw-stack-trace') || !hasAbsoluteFilePaths,
          tooltip: state.display.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : !hasAbsoluteFilePaths
              ? t('Absolute file paths not available')
              : undefined,
        },
        {
          label: displayOptions.minified,
          value: 'minified',
          disabled: !hasMinified,
          tooltip: !hasMinified ? t('Unsymbolicated version not available') : undefined,
        },
        {
          label: displayOptions['raw-stack-trace'],
          value: 'raw-stack-trace',
        },
        {
          label: displayOptions['verbose-function-names'],
          value: 'verbose-function-names',
          disabled: state.display.includes('raw-stack-trace') || !hasVerboseFunctionNames,
          tooltip: state.display.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : !hasVerboseFunctionNames
              ? t('Verbose function names not available')
              : undefined,
        },
      ];
    }

    if (platform.startsWith('python')) {
      return [
        {
          label: displayOptions['raw-stack-trace'],
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
          tooltip: !hasMinified ? t('Minified version not available') : undefined,
        },
        {
          label: displayOptions['raw-stack-trace'],
          value: 'raw-stack-trace',
        },
      ];
    }

    return [
      {
        label: displayOptions.minified,
        value: 'minified',
        disabled: !hasMinified,
        tooltip: !hasMinified ? t('Minified version not available') : undefined,
      },
      {
        label: displayOptions['raw-stack-trace'],
        value: 'raw-stack-trace',
      },
    ];
  }

  const nativePlatform = isNativePlatform(platform);
  const minified = state.display.includes('minified');

  // Apple crash report endpoint
  const appleCrashEndpoint = `/projects/${organization.slug}/${projectSlug}/events/${eventId}/apple-crash-report?minified=${minified}`;
  const rawStackTraceDownloadLink = `${api.baseUrl}${appleCrashEndpoint}&download=1`;

  const sortByTooltip = !hasNewestFirst
    ? t('Not available on stack trace with single frame')
    : state.display.includes('raw-stack-trace')
      ? t('Not available on raw stack trace')
      : undefined;

  const childProps = {
    recentFirst: state.sortBy === 'recent-first',
    display: state.display,
    fullStackTrace: state.fullStackTrace,
  };

  const SectionComponent = isNestedSection ? InlineThreadSection : InterimSection;

  return (
    <SectionComponent
      type={type}
      showPermalink={!hasStreamlinedUI}
      title={title}
      actions={
        !stackTraceNotFound && (
          <ButtonBar gap={1}>
            {!state.display.includes('raw-stack-trace') && (
              <Tooltip
                title={t('Only full version available')}
                disabled={hasAppOnlyFrames}
              >
                <SegmentedControl
                  size="xs"
                  aria-label={t('Filter frames')}
                  value={state.fullStackTrace ? 'full' : 'relevant'}
                  onChange={handleFilterFramesChange}
                >
                  <SegmentedControl.Item key="relevant" disabled={!hasAppOnlyFrames}>
                    {t('Most Relevant')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item key="full">
                    {t('Full Stack Trace')}
                  </SegmentedControl.Item>
                </SegmentedControl>
              </Tooltip>
            )}
            {state.display.includes('raw-stack-trace') && nativePlatform && (
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
              value={state.sortBy}
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
              }}
              multiple
              triggerLabel=""
              position="bottom-end"
              value={state.display}
              onChange={opts => handleDisplayChange(opts.map(opt => opt.value))}
              options={[{label: t('Display'), options: getDisplayOptions()}]}
            />
          </ButtonBar>
        )
      }
    >
      <TraceEventDataSectionContext.Provider value={childProps}>
        {children(childProps)}
      </TraceEventDataSectionContext.Provider>
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
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;

const InlineSectionHeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;
