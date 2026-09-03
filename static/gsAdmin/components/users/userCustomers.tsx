import {Button} from '@sentry/scraps/button';
import {useModal} from '@sentry/scraps/modal';

import {AddToOrgModal, RemoveFromOrgModal} from 'admin/components/addOrRemoveOrgModal';
import {CustomerGrid} from 'admin/components/customerGrid';

type Props = {
  userId: string;
};

export function UserCustomers({userId}: Props) {
  const {openModal} = useModal();

  const openAddToOrgModal = () => {
    openModal(modalProps => <AddToOrgModal {...modalProps} userId={userId} />);
  };

  const openRemoveFromOrgModal = () => {
    openModal(modalProps => <RemoveFromOrgModal {...modalProps} userId={userId} />);
  };

  return (
    <CustomerGrid
      panelTitle="Organization Membership"
      path={`/_admin/users/${userId}/`}
      endpoint={`/users/${userId}/customers/`}
      isCellScoped
      // Org memberships are cell-scoped. Query every region in parallel by
      // default so the grid shows all of the user's orgs with their region.
      allowAllRegions
      // When an admin narrows to a single region, still probe the others and
      // flag when the user also belongs to orgs elsewhere.
      probeAllRegions
      probeAllRegionsHint="This user also belongs to organizations in other regions — look there too:"
      hasSearch={false}
      sortOptions={undefined}
      filters={undefined}
      defaultParams={{per_page: 10}}
      useQueryString={false}
      buttonGroup={
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={openAddToOrgModal}
            style={{
              marginRight: 8,
            }}
          >
            Add to Org
          </Button>
          <Button variant="secondary" size="sm" onClick={openRemoveFromOrgModal}>
            Remove from Org
          </Button>
        </div>
      }
    />
  );
}
