import {createContext, Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import BooleanField from 'sentry/components/forms/booleanField';
import {IconAnchor} from 'sentry/icons/iconAnchor';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PlatformType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import EventDataSection from '../eventDataSection';

import DisplayOptions, {DisplayOption} from './displayOptions';
import SortOptions, {SortOption} from './sortOptions';

type Props = {
  children: (childProps: State) => React.ReactNode;
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

type State = {
  activeDisplayOptions: DisplayOption[];
  raw: boolean;
  recentFirst: boolean;
};

const TraceEventDataSectionContext = createContext<State | undefined>(undefined);

function TraceEventDataSection({
  title,
  type,
  children,
  projectId,
  eventId,
  stackType,
  platform,
  showPermalink,
  wrapTitle,
  hasVerboseFunctionNames,
  hasMinified,
  hasAbsoluteFilePaths,
  hasAbsoluteAddresses,
  hasAppOnlyFrames,
  hasNewestFirst,
  stackTraceNotFound,
  ...defaultStateProps
}: Props) {
  const api = useApi();
  const organization = useOrganization();

  const [state, setState] = useState<State>(() => {
    const {recentFirst, fullStackTrace} = defaultStateProps;
    return {
      raw: false,
      recentFirst,
      activeDisplayOptions: fullStackTrace ? [DisplayOption.FULL_STACK_TRACE] : [],
    };
  });

  const {recentFirst, raw, activeDisplayOptions} = state;

  useEffect(() => {
    if (
      raw ||
      (!defaultStateProps.fullStackTrace &&
        !activeDisplayOptions.includes(DisplayOption.FULL_STACK_TRACE)) ||
      (defaultStateProps.fullStackTrace &&
        activeDisplayOptions.includes(DisplayOption.FULL_STACK_TRACE))
    ) {
      return;
    }

    setState({
      ...state,
      activeDisplayOptions: !defaultStateProps.fullStackTrace
        ? activeDisplayOptions.filter(
            activeDisplayOption => activeDisplayOption !== DisplayOption.FULL_STACK_TRACE
          )
        : [...activeDisplayOptions, DisplayOption.FULL_STACK_TRACE],
    });
  }, [defaultStateProps.fullStackTrace]);

  function getDownloadHref() {
    const minified = stackType === STACK_TYPE.MINIFIED;
    // Apple crash report endpoint
    const endpoint = `/projects/${organization.slug}/${projectId}/events/${eventId}/apple-crash-report?minified=${minified}`;
    return `${api.baseUrl}${endpoint}&download=1`;
  }

  const childProps = {recentFirst, raw, activeDisplayOptions};

  const nativePlatform = isNativePlatform(platform);

  return (
    <EventDataSection
      type={type}
      title={
        <Header raw={raw} nativePlatform={nativePlatform}>
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
          {!stackTraceNotFound && (
            <Fragment>
              <RawToggler
                name="raw-stack-trace"
                label={t('Raw')}
                hideControlState
                value={raw}
                onChange={() => setState({...state, raw: !raw})}
              />
              {raw && nativePlatform && (
                <DownloadButton
                  size="small"
                  href={getDownloadHref()}
                  title={t('Download raw stack trace file')}
                >
                  {t('Download')}
                </DownloadButton>
              )}
              {!raw && (
                <SortOptions
                  disabled={!hasNewestFirst}
                  activeSortOption={
                    recentFirst ? SortOption.RECENT_FIRST : SortOption.RECENT_LAST
                  }
                  onChange={newSortOption =>
                    setState({
                      ...state,
                      recentFirst: newSortOption === SortOption.RECENT_FIRST,
                    })
                  }
                />
              )}
              <DisplayOptions
                raw={raw}
                platform={platform}
                hasAppOnlyFrames={hasAppOnlyFrames}
                hasAbsoluteAddresses={hasAbsoluteAddresses}
                hasAbsoluteFilePaths={hasAbsoluteFilePaths}
                hasVerboseFunctionNames={hasVerboseFunctionNames}
                hasMinified={hasMinified}
                activeDisplayOptions={activeDisplayOptions}
                onChange={newActiveDisplayOptions =>
                  setState({
                    ...state,
                    activeDisplayOptions: newActiveDisplayOptions,
                  })
                }
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

export {TraceEventDataSectionContext};
export default TraceEventDataSection;

const Header = styled('div')<{nativePlatform: boolean; raw: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-template-rows: ${p =>
    p.raw && !p.nativePlatform ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'};
  gap: ${space(1)};
  align-items: center;
  flex: 1;
  z-index: 3;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: ${p =>
      p.raw && !p.nativePlatform
        ? '1fr max-content minmax(140px, auto)'
        : 'repeat(2, 1fr)'};
    grid-template-rows: ${p => (p.raw && !p.nativePlatform ? '1fr' : 'repeat(2, 1fr)')};
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: ${p =>
      p.raw
        ? p.nativePlatform
          ? '1fr max-content max-content minmax(140px, auto)'
          : '1fr max-content minmax(140px, auto)'
        : '1fr max-content minmax(159px, auto) minmax(140px, auto)'};
    grid-template-rows: 1fr;
  }
`;

const RawToggler = styled(BooleanField)`
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

const DownloadButton = styled(Button)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 1/-1;
  }
`;

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
