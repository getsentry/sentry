import {AnchorHTMLAttributes, cloneElement, createContext, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis, IconLink, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PlatformType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {EventDataSection} from './eventDataSection';

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
  platform: PlatformType;
  projectSlug: Project['slug'];
  recentFirst: boolean;
  stackTraceNotFound: boolean;
  stackType: STACK_TYPE;
  title: React.ReactElement<any, any>;
  type: string;
  wrapTitle?: boolean;
};

export const TraceEventDataSectionContext = createContext<ChildProps | undefined>(
  undefined
);

export function TraceEventDataSection({
  type,
  title,
  wrapTitle,
  stackTraceNotFound,
  fullStackTrace,
  recentFirst,
  children,
  platform,
  stackType,
  projectSlug,
  eventId,
  hasNewestFirst,
  hasMinified,
  hasVerboseFunctionNames,
  hasAbsoluteFilePaths,
  hasAbsoluteAddresses,
  hasAppOnlyFrames,
}: Props) {
  const api = useApi();
  const organization = useOrganization();

  const [state, setState] = useState<State>({
    sortBy: recentFirst ? 'recent-first' : 'recent-last',
    fullStackTrace: !hasAppOnlyFrames ? true : fullStackTrace,
    display: [],
  });

  function getDisplayOptions(): {
    label: string;
    value: keyof typeof displayOptions;
    disabled?: boolean;
    tooltip?: string;
  }[] {
    if (platform === 'objc' || platform === 'native' || platform === 'cocoa') {
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
  const minified = stackType === STACK_TYPE.MINIFIED;

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

  return (
    <EventDataSection
      type={type}
      title={cloneElement(title, {type})}
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
                  onChange={val => setState({...state, fullStackTrace: val === 'full'})}
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
              <Button
                size="xs"
                href={rawStackTraceDownloadLink}
                title={t('Download raw stack trace file')}
              >
                {t('Download')}
              </Button>
            )}
            <CompactSelect
              triggerProps={{
                icon: <IconSort size="xs" />,
                size: 'xs',
                title: sortByTooltip,
              }}
              disabled={!!sortByTooltip}
              position="bottom-end"
              onChange={selectedOption => {
                setState({...state, sortBy: selectedOption.value});
              }}
              value={state.sortBy}
              options={Object.entries(sortByOptions).map(([value, label]) => ({
                label,
                value: value as keyof typeof sortByOptions,
              }))}
            />
            <CompactSelect
              triggerProps={{
                icon: <IconEllipsis size="xs" />,
                size: 'xs',
                showChevron: false,
                'aria-label': t('Options'),
              }}
              multiple
              triggerLabel=""
              position="bottom-end"
              value={state.display}
              onChange={opts => setState({...state, display: opts.map(opt => opt.value)})}
              options={[{label: t('Display'), options: getDisplayOptions()}]}
            />
          </ButtonBar>
        )
      }
      showPermalink={false}
      wrapTitle={wrapTitle}
    >
      <TraceEventDataSectionContext.Provider value={childProps}>
        {children(childProps)}
      </TraceEventDataSectionContext.Provider>
    </EventDataSection>
  );
}

interface PermalinkTitleProps
  extends React.DetailedHTMLProps<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    HTMLAnchorElement
  > {}

export function PermalinkTitle(props: PermalinkTitleProps) {
  return (
    <Permalink {...props} href={'#' + props.type} className="permalink">
      <StyledIconLink size="xs" color="subText" />
      <h3>{props.children}</h3>
    </Permalink>
  );
}

const StyledIconLink = styled(IconLink)`
  display: none;
  position: absolute;
  top: 50%;
  left: -${space(2)};
  transform: translateY(-50%);
`;

const Permalink = styled('a')`
  display: inline-flex;
  justify-content: flex-start;

  &:hover ${StyledIconLink} {
    display: block;
  }
`;
