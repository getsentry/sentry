import React, {ComponentProps, ReactNode} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import {hydratedSelectorData} from 'sentry/components/replays/utils';
import {IconCursorArrow, IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SelectorTable from 'sentry/views/replays/deadRageClick/selectorTable';

function DeadRageSelectorCards() {
  const location = useLocation();

  return (
    <SplitCardContainer>
      <DeadClickTable location={location} />
      <RageClickTable location={location} />
    </SplitCardContainer>
  );
}

function DeadClickTable({location}: {location: Location<any>}) {
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 3,
    sort: '-count_dead_clicks',
    cursor: undefined,
    prefix: 'selector_',
  });

  return (
    <SelectorTable
      data={hydratedSelectorData(data, 'count_dead_clicks')}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumn={{key: 'count_dead_clicks', name: 'dead clicks'}}
      clickCountSortable={false}
      title={
        <React.Fragment>
          <IconContainer>
            <IconCursorArrow size="xs" color="yellow300" />
          </IconContainer>
          {t('Most Dead Clicks')}
        </React.Fragment>
      }
      headerButtons={
        <SearchButton
          label={t('Show all')}
          sort="-count_dead_clicks"
          path="dead-clicks"
        />
      }
      customHandleResize={() => {}}
    />
  );
}

function RageClickTable({location}: {location: Location<any>}) {
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 3,
    sort: '-count_rage_clicks',
    cursor: undefined,
    prefix: 'selector_',
  });

  return (
    <SelectorTable
      data={hydratedSelectorData(data, 'count_rage_clicks')}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumn={{key: 'count_rage_clicks', name: 'rage clicks'}}
      clickCountSortable={false}
      title={
        <React.Fragment>
          <IconContainer>
            <IconCursorArrow size="xs" color="red300" />
          </IconContainer>
          {t('Most Rage Clicks')}
        </React.Fragment>
      }
      headerButtons={
        <SearchButton
          label={t('Show all')}
          sort="-count_rage_clicks"
          path="rage-clicks"
        />
      }
      customHandleResize={() => {}}
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
    <LinkButton
      {...props}
      size="xs"
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${path}/`),
        query: {
          ...location.query,
          sort,
          query: undefined,
          cursor: undefined,
        },
      }}
      icon={<IconShow size="xs" />}
    >
      {label}
    </LinkButton>
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

const IconContainer = styled('span')`
  margin-right: ${space(1)};
`;

export default DeadRageSelectorCards;
