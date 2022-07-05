import {createContext, Fragment, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import BooleanField from 'sentry/components/forms/booleanField';
import CompositeSelect from 'sentry/components/forms/compositeSelect';
import Tooltip from 'sentry/components/tooltip';
import {IconSliders} from 'sentry/icons';
import {IconAnchor} from 'sentry/icons/iconAnchor';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PlatformType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import EventDataSection from './eventDataSection';

const sortByOptions = {
  'recent-first': t('Recent first'),
  'recent-last': t('Recent last'),
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
  projectId: Project['id'];
  recentFirst: boolean;
  stackTraceNotFound: boolean;
  stackType: STACK_TYPE;
  title: React.ReactNode;
  type: string;
  showPermalink?: boolean;
  wrapTitle?: boolean;
};

export const TraceEventDataSectionContext = createContext<ChildProps | undefined>(
  undefined
);

export function TraceEventDataSection({
  type,
  title,
  showPermalink,
  wrapTitle,
  stackTraceNotFound,
  fullStackTrace,
  recentFirst,
  children,
  platform,
  stackType,
  projectId,
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
    fullStackTrace,
    display: [],
  });

  function getDisplayOptions(): {
    label: string;
    value: keyof typeof displayOptions;
    isDisabled?: boolean;
    tooltip?: string;
  }[] {
    if (platform === 'objc' || platform === 'native' || platform === 'cocoa') {
      return [
        {
          label: displayOptions['absolute-addresses'],
          value: 'absolute-addresses',
          isDisabled: state.display.includes('raw-stack-trace') || !hasAbsoluteAddresses,
          tooltip: state.display.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : !hasAbsoluteAddresses
            ? t('Absolute addresses not available')
            : undefined,
        },
        {
          label: displayOptions['absolute-file-paths'],
          value: 'absolute-file-paths',
          isDisabled: state.display.includes('raw-stack-trace') || !hasAbsoluteFilePaths,
          tooltip: state.display.includes('raw-stack-trace')
            ? t('Not available on raw stack trace')
            : !hasAbsoluteFilePaths
            ? t('Absolute file paths not available')
            : undefined,
        },
        {
          label: displayOptions.minified,
          value: 'minified',
          isDisabled: !hasMinified,
          tooltip: !hasMinified ? t('Unsymbolicated version not available') : undefined,
        },
        {
          label: displayOptions['raw-stack-trace'],
          value: 'raw-stack-trace',
        },
        {
          label: displayOptions['verbose-function-names'],
          value: 'verbose-function-names',
          isDisabled:
            state.display.includes('raw-stack-trace') || !hasVerboseFunctionNames,
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
        isDisabled: !hasMinified,
        tooltip: !hasMinified ? t('Minified version not available') : undefined,
      },
    ];
  }

  const nativePlatform = isNativePlatform(platform);
  const minified = stackType === STACK_TYPE.MINIFIED;

  // Apple crash report endpoint
  const appleCrashEndpoint = `/projects/${organization.slug}/${projectId}/events/${eventId}/apple-crash-report?minified=${minified}`;
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
      title={
        <Header>
          <Title>
            {showPermalink ? (
              <div>
                <Permalink href={'#' + type} className="permalink">
                  <StyledIconAnchor />
                  {title}
                </Permalink>
              </div>
            ) : (
              title
            )}
          </Title>
          {!stackTraceNotFound && (
            <Fragment>
              {!state.display.includes('raw-stack-trace') && (
                <Tooltip
                  title={!hasAppOnlyFrames ? t('Only full version available') : undefined}
                  disabled={hasAppOnlyFrames}
                >
                  <FullStackTraceToggler
                    name="full-stack-trace-toggler"
                    label={t('Full stack trace')}
                    hideControlState
                    value={state.fullStackTrace}
                    onChange={() =>
                      setState({
                        ...state,
                        fullStackTrace: !state.fullStackTrace,
                      })
                    }
                  />
                </Tooltip>
              )}
              {state.display.includes('raw-stack-trace') && nativePlatform && (
                <Button
                  size="sm"
                  href={rawStackTraceDownloadLink}
                  title={t('Download raw stack trace file')}
                >
                  {t('Download')}
                </Button>
              )}
              <CompositeSelect
                triggerLabel={t('Options')}
                triggerProps={{
                  icon: <IconSliders />,
                  size: 'sm',
                }}
                placement="bottom right"
                sections={[
                  {
                    label: t('Sort By'),
                    value: 'sort-by',
                    defaultValue: state.sortBy,
                    options: Object.entries(sortByOptions).map(([value, label]) => ({
                      label,
                      value,
                      isDisabled: !!sortByTooltip,
                      tooltip: sortByTooltip,
                    })),
                    onChange: sortBy => setState({...state, sortBy}),
                  },
                  {
                    label: t('Display'),
                    value: 'display',
                    defaultValue: state.display,
                    multiple: true,
                    options: getDisplayOptions().map(option => ({
                      ...option,
                      value: String(option.value),
                    })),
                    onChange: display => setState({...state, display}),
                  },
                ]}
              />
            </Fragment>
          )}
        </Header>
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

const StyledIconAnchor = styled(IconAnchor)`
  display: none;
  position: absolute;
  top: 4px;
  left: -22px;
`;

const Permalink = styled('a')`
  display: inline-flex;
  justify-content: flex-start;
  :hover ${StyledIconAnchor} {
    display: block;
    color: ${p => p.theme.gray300};
  }
`;

const FullStackTraceToggler = styled(BooleanField)`
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(1)};
  border-bottom: none;
  justify-content: flex-end;

  && {
    > * {
      padding: 0;
      width: auto;
    }
  }
`;

const Header = styled('div')`
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
  align-items: center;
  justify-content: space-between;
`;

const Title = styled('div')`
  flex: 1;
  & > *:first-child {
    width: auto;
  }
`;
