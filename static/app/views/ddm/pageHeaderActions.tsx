import {useMemo} from 'react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconBookmark, IconDashboard, IconEllipsis, IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {isCustomMeasurement} from 'sentry/utils/metrics';
import {MRIToField} from 'sentry/utils/metrics/mri';
import {middleEllipsis} from 'sentry/utils/middleEllipsis';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {useDDMContext} from 'sentry/views/ddm/context';
import {getCreateAlert} from 'sentry/views/ddm/contextMenu';
import {QuerySymbol} from 'sentry/views/ddm/querySymbol';
import {useCreateDashboard} from 'sentry/views/ddm/useCreateDashboard';

interface Props {
  addCustomMetric: (referrer: string) => void;
  showCustomMetricButton: boolean;
}

export function PageHeaderActions({showCustomMetricButton, addCustomMetric}: Props) {
  const router = useRouter();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const createDashboard = useCreateDashboard();
  const {isDefaultQuery, setDefaultQuery, widgets} = useDDMContext();

  const items = useMemo(
    () => [
      {
        leadingItems: [<IconDashboard key="icon" />],
        key: 'add-dashboard',
        label: t('Add to Dashboard'),
        onAction: createDashboard,
      },
    ],
    [createDashboard]
  );

  const alertItems = useMemo(
    () =>
      widgets.map((widget, index) => {
        const createAlert = getCreateAlert(organization, {
          datetime: selection.datetime,
          projects: selection.projects,
          environments: selection.environments,
          query: widget.query,
          mri: widget.mri,
          groupBy: widget.groupBy,
          op: widget.op,
        });
        return {
          leadingItems: [<QuerySymbol key="icon" index={index} />],
          key: `add-alert-${index}`,
          label: widget.mri
            ? middleEllipsis(MRIToField(widget.mri, widget.op!), 60, /\.|-|_/)
            : t('Select a metric to create an alert'),
          tooltip: isCustomMeasurement({mri: widget.mri})
            ? t('Custom measurements cannot be used to create alerts')
            : undefined,
          disabled: !createAlert,
          onAction: createAlert,
        };
      }),
    [
      organization,
      selection.datetime,
      selection.environments,
      selection.projects,
      widgets,
    ]
  );

  return (
    <ButtonBar gap={1}>
      {showCustomMetricButton && (
        <Button priority="primary" onClick={() => addCustomMetric('header')} size="sm">
          {t('Add Custom Metric')}
        </Button>
      )}
      <Button
        size="sm"
        icon={<IconBookmark isSolid={isDefaultQuery} />}
        onClick={() => setDefaultQuery(isDefaultQuery ? null : router.location.query)}
      >
        {isDefaultQuery ? t('Remove Default') : t('Save as default')}
      </Button>
      <DropdownMenu
        items={alertItems}
        triggerLabel={t('Create Alert')}
        triggerProps={{
          size: 'sm',
          showChevron: false,
          icon: <IconSiren direction="down" size="xs" />,
        }}
        position="bottom-end"
      />
      <DropdownMenu
        items={items}
        triggerProps={{
          'aria-label': t('Page actions'),
          size: 'sm',
          showChevron: false,
          icon: <IconEllipsis direction="down" size="xs" />,
        }}
        position="bottom-end"
      />
    </ButtonBar>
  );
}
