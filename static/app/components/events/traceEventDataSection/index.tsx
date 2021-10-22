import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
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
  wrapTitle?: boolean;
  showPermalink?: boolean;
};

type State = {
  raw: boolean;
  recentFirst: boolean;
  activeDisplayOptions: DisplayOption[];
};

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

  return (
    <EventDataSection
      type={type}
      title={
        <Header>
          {title}
          <RawToggler
            name="raw-stack-trace"
            label={t('Raw')}
            hideControlState
            value={raw}
            onChange={() => setState({...state, raw: !raw})}
          />
          {raw ? (
            isNativePlatform(platform) && (
              <Button size="small" href={getDownloadHref()}>
                {t('Download')}
              </Button>
            )
          ) : (
            <Fragment>
              <SortOptions
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
      showPermalink={showPermalink}
      wrapTitle={wrapTitle}
    >
      {children({recentFirst, raw, activeDisplayOptions})}
    </EventDataSection>
  );
}

export default TraceEventDataSection;

const Header = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(3, 1fr);
  grid-gap: ${space(2)};
  flex: 1;
  z-index: 3;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-rows: repeat(2, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr repeat(3, max-content);
    grid-template-rows: 1fr;
  }
`;

const RawToggler = styled(BooleanField)`
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(1)};
  border-bottom: none;

  && {
    > * {
      padding: 0;
      width: auto;
    }
  }
`;
