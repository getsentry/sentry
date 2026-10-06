import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {updateDateTime} from 'sentry/components/pageFilters/actions';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  IconCalendar,
  IconCheckmark,
  IconFilter,
  IconFlag,
  IconGlobe,
  IconProject,
  IconUser,
  IconReleases,
  IconIssues,
  IconCode,
  IconSearch,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {IssueAdvancedFilterModal} from 'sentry/views/issueList/advancedFilterModal';
import {IssueFilterValueMenu} from 'sentry/views/issueList/filterValueMenu';
import {IssueScopeFilterMenu} from 'sentry/views/issueList/scopeFilterMenu';

const FILTER_FIELDS = [
  {
    key: 'is',
    label: t('Status'),
    icon: <IconFilter />,
  },
  {
    key: 'issue.priority',
    label: t('Priority'),
    icon: <IconFlag />,
  },
  {
    key: 'assigned',
    label: t('Assignee'),
    icon: <IconUser />,
  },
  {
    key: 'level',
    label: t('Level'),
    icon: <IconFlag />,
  },
  {key: 'release', label: t('Release'), icon: <IconReleases />},
  {key: 'issue.category', label: t('Issue category'), icon: <IconIssues />},
  {key: 'issue.type', label: t('Issue type'), icon: <IconIssues />},
  {key: 'error.type', label: t('Error type'), icon: <IconCode />},
];

const DATE_RANGES = [
  {value: '1h', label: t('Last hour')},
  {value: '24h', label: t('Last 24 hours')},
  {value: '7d', label: t('Last 7 days')},
  {value: '14d', label: t('Last 14 days')},
  {value: '30d', label: t('Last 30 days')},
];

const UPDATE_OPTIONS = {save: true, resetParams: ['page', 'cursor']};

function checked(selected: boolean) {
  return selected ? <IconCheckmark size="sm" /> : undefined;
}

export function IssueFilterMenu({
  query,
  onSearch,
}: {
  onSearch: (query: string) => void;
  query: string;
}) {
  const location = useLocation();
  const {openModal} = useModal();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const items: MenuItemProps[] = [
    ...FILTER_FIELDS.map((field): MenuItemProps => ({
      key: field.key,
      label: field.label,
      leadingItems: field.icon,
      submenu: {
        title: field.label,
        content: ({close}) => (
          <IssueFilterValueMenu
            fieldKey={field.key}
            query={query}
            onSearch={onSearch}
            onClose={close}
          />
        ),
      },
    })),
    {
      key: 'projects',
      label: t('Projects'),
      leadingItems: <IconProject />,
      submenu: {
        title: t('Projects'),
        content: ({close}) => <IssueScopeFilterMenu scope="projects" onClose={close} />,
      },
    },
    {
      key: 'environments',
      label: t('Environment'),
      leadingItems: <IconGlobe />,
      submenu: {
        title: t('Environment'),
        content: ({close}) => (
          <IssueScopeFilterMenu scope="environments" onClose={close} />
        ),
      },
    },
    {
      key: 'date',
      label: t('Date range'),
      leadingItems: <IconCalendar />,
      submenu: true,
      children: DATE_RANGES.map(range => ({
        key: `date:${range.value}`,
        label: range.label,
        trailingItems: checked(selection.datetime.period === range.value),
        onAction: () =>
          updateDateTime(
            {period: range.value, start: null, end: null},
            location,
            navigate,
            UPDATE_OPTIONS
          ),
      })),
    },
    {
      key: 'advanced',
      label: t('Advanced filter'),
      leadingItems: <IconSearch />,
      onAction: () =>
        openModal(props => (
          <IssueAdvancedFilterModal {...props} query={query} onSearch={onSearch} />
        )),
    },
  ];

  return (
    <DropdownMenu
      items={items}
      position="bottom-end"
      minMenuWidth={260}
      trigger={props => (
        <OverlayTrigger.IconButton
          {...props}
          variant="transparent"
          aria-label={t('Filter')}
          tooltipProps={{title: t('Filter')}}
          icon={<IconFilter />}
        />
      )}
    />
  );
}
