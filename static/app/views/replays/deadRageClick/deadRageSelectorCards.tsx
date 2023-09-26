import {ComponentProps, Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import OpenClosePanel from 'sentry/components/openClosePanel';
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

  function header(isOpen: boolean) {
    return isOpen
      ? t('Hide Actionable Replay Insights')
      : t('Show Actionable Replay Insights');
  }

  return (
    <OpenClosePanel header={header} openByDefault>
      <SplitCardContainer>
        <DeadClickTable location={location} />
        <RageClickTable location={location} />
      </SplitCardContainer>
    </OpenClosePanel>
  );
}

function DeadClickTable({location}: {location: Location<any>}) {
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 4,
    sort: '-count_dead_clicks',
    cursor: undefined,
    prefix: 'selector_',
  });

  return (
    <SelectorTable
      data={data.filter(d => (d.count_dead_clicks ?? 0) > 0)}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumn={{key: 'count_dead_clicks', name: 'dead clicks'}}
      title={
        <Fragment>
          <IconContainer>
            <IconCursorArrow size="xs" color="yellow300" />
          </IconContainer>
          {t('Most Dead Clicks')}
        </Fragment>
      }
      headerButtons={
        <SearchButton
          label={t('Show all')}
          sort="-count_dead_clicks"
          path="dead-clicks"
        />
      }
      customHandleResize={() => {}}
      clickCountSortable={false}
    />
  );
}

function RageClickTable({location}: {location: Location<any>}) {
  const {isLoading, isError, data} = useDeadRageSelectors({
    per_page: 4,
    sort: '-count_rage_clicks',
    cursor: undefined,
    prefix: 'selector_',
  });

  return (
    <SelectorTable
      data={data.filter(d => (d.count_rage_clicks ?? 0) > 0)}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumn={{key: 'count_rage_clicks', name: 'rage clicks'}}
      title={
        <Fragment>
          <IconContainer>
            <IconCursorArrow size="xs" color="red300" />
          </IconContainer>
          {t('Most Rage Clicks')}
        </Fragment>
      }
      headerButtons={
        <SearchButton
          label={t('Show all')}
          sort="-count_rage_clicks"
          path="rage-clicks"
        />
      }
      customHandleResize={() => {}}
      clickCountSortable={false}
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
