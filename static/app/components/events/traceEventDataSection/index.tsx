import {createContext, Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAnchor} from 'app/icons/iconAnchor';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {PlatformType, Project} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_TYPE} from 'app/types/stacktrace';
import {isNativePlatform} from 'app/utils/platform';
import useApi from 'app/utils/useApi';
import {useOrganization} from 'app/utils/useOrganization';
import BooleanField from 'app/views/settings/components/forms/booleanField';

import EventDataSection from '../eventDataSection';

import DisplayOptions, {DisplayOption} from './displayOptions';
import SortOptions, {SortOption} from './sortOptions';

type Props = {
  title: React.ReactNode;
  type: string;
  recentFirst: boolean;
  fullStackTrace: boolean;
  children: (childProps: State) => React.ReactNode;
  projectId: Project['id'];
  eventId: Event['id'];
  stackType: STACK_TYPE;
  platform: PlatformType;
  hasVerboseFunctionNames: boolean;
  hasMinified: boolean;
  hasAbsoluteFilePaths: boolean;
  hasAbsoluteAddresses: boolean;
  hasAppOnlyFrames: boolean;
  hasNewestFirst: boolean;
  stackTraceNotFound: boolean;
  wrapTitle?: boolean;
  showPermalink?: boolean;
};

type State = {
  raw: boolean;
  recentFirst: boolean;
  activeDisplayOptions: DisplayOption[];
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
    if (raw || activeDisplayOptions.includes(DisplayOption.FULL_STACK_TRACE)) {
      return;
    }

    setState({
      ...state,
      activeDisplayOptions: [...activeDisplayOptions, DisplayOption.FULL_STACK_TRACE],
    });
  }, [defaultStateProps.fullStackTrace]);

  function getDownloadHref() {
    const minified = stackType === STACK_TYPE.MINIFIED;
    // Apple crash report endpoint
    const endpoint = `/projects/${organization.slug}/${projectId}/events/${eventId}/apple-crash-report?minified=${minified}`;
    return `${api.baseUrl}${endpoint}&download=1`;
  }

  const childProps = {recentFirst, raw, activeDisplayOptions};

  return (
    <EventDataSection
      type={type}
      title={
        <Header raw={raw}>
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
              {raw ? (
                isNativePlatform(platform) && (
                  <Button
                    size="small"
                    href={getDownloadHref()}
                    title={t('Download raw stack trace file')}
                  >
                    {t('Download')}
                  </Button>
                )
              ) : (
                <Fragment>
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
                  <DisplayOptions
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

const Header = styled('div')<{raw: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-template-rows: repeat(3, 1fr);
  grid-gap: ${space(2)};
  flex: 1;
  z-index: 3;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-rows: repeat(2, 1fr);
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: ${p =>
      p.raw
        ? '1fr repeat(2, max-content)'
        : '1fr max-content minmax(159px, auto) minmax(140px, auto)'};
    grid-template-rows: 1fr;
  }
`;

const RawToggler = styled(BooleanField)`
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(1)};
  border-bottom: none;
  justify-content: flex-end;

  && {
    > * {
      padding: 0;
      width: auto;
    }
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
