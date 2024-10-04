import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconBookmark, IconEllipsis, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useMetricsContext} from 'sentry/views/metrics/context';

interface Props {
  addCustomMetric: () => void;
  showAddMetricButton: boolean;
}

export function PageHeaderActions({showAddMetricButton, addCustomMetric}: Props) {
  const router = useRouter();
  const organization = useOrganization();

  const {isDefaultQuery, setDefaultQuery} = useMetricsContext();

  const handleToggleDefaultQuery = useCallback(() => {
    if (isDefaultQuery) {
      Sentry.metrics.increment('ddm.remove-default-query');
      trackAnalytics('ddm.remove-default-query', {
        organization,
      });
      setDefaultQuery(null);
    } else {
      Sentry.metrics.increment('ddm.set-default-query');
      trackAnalytics('ddm.set-default-query', {
        organization,
      });
      setDefaultQuery(router.location.query);
    }
  }, [isDefaultQuery, organization, router.location.query, setDefaultQuery]);

  const items = useMemo(
    () => [
      {
        leadingItems: [<IconSettings key="icon" />],
        key: 'Metrics Settings',
        label: t('Metrics Settings'),
        onAction: () => navigateTo(`/settings/projects/:projectId/metrics/`, router),
      },
    ],
    [router]
  );

  return (
    <ButtonBar gap={1}>
      {showAddMetricButton && (
        <Button priority="primary" onClick={() => addCustomMetric()} size="sm">
          {t('Add Custom Metrics')}
        </Button>
      )}
      <Button
        size="sm"
        icon={<IconBookmark isSolid={isDefaultQuery} />}
        onClick={handleToggleDefaultQuery}
      >
        {isDefaultQuery ? t('Remove Default') : t('Save as default')}
      </Button>
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
