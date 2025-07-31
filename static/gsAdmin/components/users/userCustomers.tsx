import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';

import {AddToOrgModal, RemoveFromOrgModal} from 'admin/components/addOrRemoveOrgModal';
import CustomerGrid from 'admin/components/customerGrid';

type Props = {
  userId: string;
};

function UserCustomers({userId}: Props) {
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
      hasSearch={false}
      sortOptions={undefined}
      filters={undefined}
      defaultParams={{per_page: 10}}
      useQueryString={false}
      buttonGroup={
        <div>
          <Button
            priority="primary"
            size="sm"
            onClick={openAddToOrgModal}
            style={{
              marginRight: 8,
            }}
          >
            Add to Org
          </Button>
          <Button priority="default" size="sm" onClick={openRemoveFromOrgModal}>
            Remove from Org
          </Button>
        </div>
      }
    />
  );
}

export default UserCustomers;
