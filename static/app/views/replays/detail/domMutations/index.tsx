import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import CompactSelect from 'sentry/components/forms/compactSelect';
import HTMLCode from 'sentry/components/htmlCode';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import SearchBar from 'sentry/components/searchBar';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useExtractedCrumbHtml, {
  Extraction,
} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {getDomMutationsTypes} from 'sentry/views/replays/detail/domMutations/utils';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {Filters, getFilteredItems} from 'sentry/views/replays/detail/utils';

type Props = {
  replay: ReplayReader;
};

function DomMutations({replay}: Props) {
  const {isLoading, actions} = useExtractedCrumbHtml({replay});
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Filters<Extraction>>({});

  const filteredDomMutations = useMemo(
    () =>
      getFilteredItems({
        items: actions,
        filters,
        searchTerm,
        searchProp: 'html',
      }),
    [actions, filters, searchTerm]
  );

  const handleSearch = useMemo(() => debounce(query => setSearchTerm(query), 150), []);

  const startTimestampMs = replay.getReplay().startedAt.getTime();

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const handleFilters = useCallback(
    (
      selectedValues: (string | number)[],
      key: string,
      filter: (mutation: Extraction) => boolean
    ) => {
      const filtersCopy = {...filters};

      if (selectedValues.length === 0) {
        delete filtersCopy[key];
        setFilters(filtersCopy);
        return;
      }

      setFilters({
        ...filters,
        [key]: filter,
      });
    },
    [filters]
  );

  if (isLoading) {
    return null;
  }

  if (actions.length === 0) {
    return (
      <EmptyStateWarning withIcon={false} small>
        {t('No DOM Events recorded')}
      </EmptyStateWarning>
    );
  }

  return (
    <MutationContainer>
      <MutationFilters>
        <CompactSelect
          triggerProps={{
            prefix: t('Event Type'),
          }}
          multiple
          options={getDomMutationsTypes(actions).map(mutationEventType => ({
            value: mutationEventType,
            label: mutationEventType,
          }))}
          size="sm"
          onChange={selections => {
            const selectedValues = selections.map(selection => selection.value);

            handleFilters(selectedValues, 'eventType', (mutation: Extraction) => {
              return selectedValues.includes(mutation.crumb.type);
            });
          }}
        />

        <SearchBar size="sm" onChange={handleSearch} placeholder={t('Search DOM')} />
      </MutationFilters>
      <MutationList>
        {filteredDomMutations.map((mutation, i) => (
          <MutationListItem
            key={i}
            onMouseEnter={() => handleMouseEnter(mutation.crumb)}
            onMouseLeave={() => handleMouseLeave(mutation.crumb)}
          >
            {i < actions.length - 1 && <StepConnector />}
            <IconWrapper color={mutation.crumb.color}>
              <BreadcrumbIcon type={mutation.crumb.type} />
            </IconWrapper>
            <MutationContent>
              <MutationDetailsContainer>
                <div>
                  <TitleContainer>
                    <Title>{getDetails(mutation.crumb).title}</Title>
                  </TitleContainer>
                  <MutationMessage>{mutation.crumb.message}</MutationMessage>
                </div>
                <UnstyledButton onClick={() => handleClick(mutation.crumb)}>
                  <PlayerRelativeTime
                    relativeTimeMs={startTimestampMs}
                    timestamp={mutation.crumb.timestamp}
                  />
                </UnstyledButton>
              </MutationDetailsContainer>
              <CodeContainer>
                <HTMLCode code={mutation.html} />
              </CodeContainer>
            </MutationContent>
          </MutationListItem>
        ))}
      </MutationList>
    </MutationContainer>
  );
}

const MutationContainer = styled(FluidHeight)`
  height: 100%;
`;

const MutationFilters = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
  }
`;

const MutationList = styled('ul')`
  list-style: none;
  position: relative;
  height: 100%;
  overflow-y: auto;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding-left: 0;
  margin-bottom: 0;
`;

const MutationListItem = styled('li')`
  display: flex;
  flex-grow: 1;
  padding: ${space(2)};
  position: relative;
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const MutationContent = styled('div')`
  overflow: hidden;
  width: 100%;
  margin-left: ${space(1.5)};
  margin-right: ${space(1.5)};
`;

const MutationDetailsContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-grow: 1;
`;

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<Required<Pick<SVGIconProps, 'color'>>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  min-width: 28px;
  height: 28px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
  z-index: 2;
`;

const UnstyledButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
  line-height: 0.75;
`;

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  color: ${p => p.theme.gray400};
  font-weight: bold;
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const MutationMessage = styled('p')`
  color: ${p => p.theme.blue300};
  margin-bottom: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const CodeContainer = styled('div')`
  overflow: auto;
  max-height: 400px;
  max-width: 100%;
`;

const StepConnector = styled('div')`
  position: absolute;
  height: 100%;
  top: 28px;
  left: 29px;
  border-right: 1px ${p => p.theme.border} solid;
  z-index: 1;
`;

export default DomMutations;
