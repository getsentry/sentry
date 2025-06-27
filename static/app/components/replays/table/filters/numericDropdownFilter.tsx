import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  ActionMenuTrigger,
  generateAction,
} from 'sentry/components/replays/table/filters/utils';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

const DEFAULT_NUMERIC_DROPDOWN_FORMATTER = (val: number) => val.toString();

export default function NumericDropdownFilter({
  type,
  val,
  formatter = DEFAULT_NUMERIC_DROPDOWN_FORMATTER,
}: {
  type: string;
  val: number;
  formatter?: (val: number) => string;
}) {
  const location = useLocation<ReplayListLocationQuery>();
  const navigate = useNavigate();

  return (
    <DropdownMenu
      items={[
        {
          key: 'add',
          label: 'Add to filter',
          onAction: generateAction({
            key: type,
            value: formatter(val),
            edit: 'set',
            location,
            navigate,
          }),
        },
        {
          key: 'greater',
          label: 'Show values greater than',
          onAction: generateAction({
            key: type,
            value: '>' + formatter(val),
            edit: 'set',
            location,
            navigate,
          }),
        },
        {
          key: 'less',
          label: 'Show values less than',
          onAction: generateAction({
            key: type,
            value: '<' + formatter(val),
            edit: 'set',
            location,
            navigate,
          }),
        },
        {
          key: 'exclude',
          label: t('Exclude from filter'),
          onAction: generateAction({
            key: type,
            value: formatter(val),
            edit: 'remove',
            location,
            navigate,
          }),
        },
      ]}
      usePortal
      size="xs"
      offset={4}
      position="bottom"
      preventOverflowOptions={{padding: 4}}
      flipOptions={{
        fallbackPlacements: ['top', 'right-start', 'right-end', 'left-start', 'left-end'],
      }}
      trigger={triggerProps => (
        <ActionMenuTrigger
          {...triggerProps}
          aria-label={t('Actions')}
          data-visible-on-hover
          icon={<IconEllipsis size="xs" />}
          size="zero"
          translucentBorder
        />
      )}
    />
  );
}
