import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {IconCursorArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDeadRageSelectors from 'sentry/utils/replays/hooks/useDeadRageSelectors';
import {useLocation} from 'sentry/utils/useLocation';
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
    per_page: 4,
    sort: '-count_dead_clicks',
    cursor: undefined,
    prefix: 'selector_',
    isWidgetData: true,
  });

  return (
    <SelectorTable
      data={data.filter(d => (d.count_dead_clicks ?? 0) > 0)}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumns={[{key: 'count_dead_clicks', name: 'dead clicks'}]}
      title={
        <Fragment>
          <IconContainer>
            <IconCursorArrow size="xs" color="yellow300" />
          </IconContainer>
          {t('Most Dead Clicks')}
        </Fragment>
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
    isWidgetData: true,
  });

  return (
    <SelectorTable
      data={data.filter(d => (d.count_rage_clicks ?? 0) > 0)}
      isError={isError}
      isLoading={isLoading}
      location={location}
      clickCountColumns={[{key: 'count_rage_clicks', name: 'rage clicks'}]}
      title={
        <Fragment>
          <IconContainer>
            <IconCursorArrow size="xs" color="red300" />
          </IconContainer>
          {t('Most Rage Clicks')}
        </Fragment>
      }
      customHandleResize={() => {}}
      clickCountSortable={false}
    />
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
