import {ComponentProps, ReactNode} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import {hydratedSelectorData} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SelectorTable, {UrlState} from 'sentry/views/replays/deadRageClick/selectorTable';
import {DeadRageSelectorQueryParams} from 'sentry/views/replays/types';

function DeadRageSelectorCards() {
  const location = useLocation<DeadRageSelectorQueryParams & UrlState>();
  return (
    <SplitCardContainer>
      <DeadClickTable location={location} />
      <RageClickTable location={location} />
    </SplitCardContainer>
  );
}

function DeadClickTable({
  location,
}: {
  location: Location<DeadRageSelectorQueryParams & UrlState>;
}) {
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 3,
    sort: '-count_dead_clicks',
  });

  return (
    <SelectorTable
      data={hydratedSelectorData(data, 'count_dead_clicks')}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumn={{key: 'count_dead_clicks', name: 'dead clicks'}}
      clickCountSortable={false}
      title="Most Dead Clicks"
      headerButtons={
        <SearchButton
          label={t('Show all')}
          sort="-count_dead_clicks"
          path="dead-clicks" // temporary; this might point to a tab on the replay index later
        />
      }
    />
  );
}

function RageClickTable({
  location,
}: {
  location: Location<DeadRageSelectorQueryParams & UrlState>;
}) {
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 3,
    sort: '-count_rage_clicks',
  });

  return (
    <SelectorTable
      data={hydratedSelectorData(data, 'count_rage_clicks')}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumn={{key: 'count_rage_clicks', name: 'rage clicks'}}
      clickCountSortable={false}
      title="Most Rage Clicks"
      headerButtons={
        <SearchButton
          label={t('Show all')}
          sort="-count_rage_clicks"
          path="rage-clicks" // temporary; this might point to a tab on the replay index later
        />
      }
    />
  );
}

function SearchButton({
  label,
  sort,
  path,
  ...props
}: {
  label: ReactNode;
  path: string;
  sort: string;
} & Omit<ComponentProps<typeof LinkButton>, 'size' | 'to'>) {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <StyledButton
      {...props}
      size="sm"
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${path}/`),
        query: {
          ...location.query,
          sort,
          cursor: undefined,
        },
      }}
    >
      {label}
    </StyledButton>
  );
}

const SplitCardContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: max-content max-content;
  grid-auto-flow: column;
  gap: 0 ${space(2)};
  align-items: stretch;
  padding-top: ${space(1)};
`;

const StyledButton = styled(LinkButton)`
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};
`;

export default DeadRageSelectorCards;
