import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import toArray from 'sentry/utils/toArray';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import {addToFilter, excludeFromFilter} from '../cellAction';

export enum ContextValueType {
  STRING = 'string',
  NUMBER = 'number',
  DURATION = 'duration',
}

enum QueryUpdateActions {
  ADD = 'add',
  EXCLUDE = 'exclude',
  SHOW_MORE_THAN = 'show-more-than',
  SHOW_LESS_THAN = 'show-less-than',
}

type Props = {
  contextValueType: ContextValueType;
  dataRow: EventData;
  eventView: EventView;
  location: Location;
  organization: Organization;
  queryKey: string;
  value: React.ReactText | string[];
};

function ActionDropDown(props: Props) {
  const menuItems: MenuItemProps[] = [];
  const {location, eventView, queryKey, value, organization, contextValueType, dataRow} =
    props;

  const addAsColumn = () => {
    trackAnalytics('discover_v2.quick_context_add_column', {
      organization,
      column: queryKey,
    });

    const oldField = eventView?.fields.map(field => field.field);
    const newField = toArray(oldField).concat(queryKey);
    browserHistory.push({
      ...location,
      query: {
        ...location?.query,
        field: newField,
      },
    });
  };

  function handleQueryUpdate(actionType: QueryUpdateActions) {
    trackAnalytics('discover_v2.quick_context_update_query', {
      organization,
      queryKey,
    });

    const oldFilters = eventView?.query || '';
    const newFilters = new MutableSearch(oldFilters);

    switch (actionType) {
      case QueryUpdateActions.SHOW_MORE_THAN:
        newFilters.setFilterValues(queryKey, [`>${value}`]);
        break;
      case QueryUpdateActions.SHOW_LESS_THAN:
        newFilters.setFilterValues(queryKey, [`<${value}`]);
        break;
      case QueryUpdateActions.ADD:
        addToFilter(newFilters, queryKey, value);
        break;
      case QueryUpdateActions.EXCLUDE:
        excludeFromFilter(newFilters, queryKey, value);
        break;
      default:
        throw new Error(`Unknown quick context action type. ${actionType}`);
    }

    browserHistory.push({
      ...location,
      query: {
        ...location?.query,
        query: newFilters.formatString(),
      },
    });
  }

  if (!(queryKey in dataRow)) {
    menuItems.push({
      key: 'add-as-column',
      label: t('Add as column'),
      onAction: () => {
        addAsColumn();
      },
    });
  }

  if (
    contextValueType === ContextValueType.NUMBER ||
    contextValueType === ContextValueType.DURATION
  ) {
    menuItems.push(
      {
        key: 'show-more-than',
        label: t('Show values greater than'),
        onAction: () => {
          handleQueryUpdate(QueryUpdateActions.SHOW_MORE_THAN);
        },
      },
      {
        key: 'show-less-than',
        label: t('Show values less than'),
        onAction: () => {
          handleQueryUpdate(QueryUpdateActions.SHOW_LESS_THAN);
        },
      }
    );
  } else {
    menuItems.push(
      {
        key: 'add-to-filter',
        label: t('Add to filter'),
        onAction: () => {
          handleQueryUpdate(QueryUpdateActions.ADD);
        },
      },
      {
        key: 'exclude-from-filter',
        label: t('Exclude from filter'),
        onAction: () => {
          handleQueryUpdate(QueryUpdateActions.EXCLUDE);
        },
      }
    );
  }

  return (
    <DropdownMenu
      items={menuItems}
      trigger={triggerProps => (
        <StyledTrigger
          {...triggerProps}
          aria-label={t('Quick Context Action Menu')}
          data-test-id="quick-context-action-trigger"
          borderless
          size="zero"
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            triggerProps.onClick?.(e);
          }}
          icon={<IconEllipsis size="sm" />}
        />
      )}
    />
  );
}

const StyledTrigger = styled(Button)`
  margin-left: ${space(0.5)};
`;

export default ActionDropDown;
