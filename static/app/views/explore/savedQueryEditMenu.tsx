import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {useDeleteQuery} from 'sentry/views/explore/hooks/useDeleteQuery';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {confirmDeleteSavedQuery} from 'sentry/views/explore/utils';

export function SavedQueryEditMenu() {
  const organization = useOrganization();
  const location = useLocation();
  const locationId = getIdFromLocation(location);
  const {data: savedQuery} = useGetSavedQuery(locationId);
  const navigate = useNavigate();
  const {deleteQuery} = useDeleteQuery();

  if (!savedQuery) {
    return null;
  }

  return (
    <DropdownMenu
      items={[
        {
          key: 'delete',
          label: t('Delete Query'),
          priority: 'danger',
          onAction: () => {
            confirmDeleteSavedQuery({
              handleDelete: async () => {
                await deleteQuery(savedQuery.id);
                if (location.pathname.endsWith('compare/')) {
                  navigate(
                    normalizeUrl(
                      `/organizations/${organization.slug}/explore/traces/compare/`
                    )
                  );
                } else {
                  navigate(
                    normalizeUrl(`/organizations/${organization.slug}/explore/traces/`)
                  );
                }
                trackAnalytics('trace_explorer.delete_query', {
                  organization,
                });
              },
              savedQuery,
            });
          },
        },
      ]}
      trigger={props => (
        <Button
          size="sm" redesign
          {...props}
          icon={<IconEllipsis redesign />}
          aria-label={t('More saved query options')}
        />
      )}
      position="bottom-end"
      minMenuWidth={160}
    />
  );
}
