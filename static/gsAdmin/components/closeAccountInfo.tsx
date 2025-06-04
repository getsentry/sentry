import {Fragment} from 'react';

function CloseAccountInfo() {
  return (
    <Fragment>
      <p>
        Closing this account will schedule the organization for deletion per the standard
        delay (e.g. 24 hours). When the delete operation begins, the subscription will
        automatically be cancelled.
      </p>
      <p>
        <strong>
          Are you sure you wish to continue? Once the process begins it is NOT REVERSIBLE.
        </strong>
      </p>
      <p>
        <small>
          Note: The customer will receive an email letting them know the account closure
          has been initiated.
        </small>
      </p>
    </Fragment>
  );
}

export default CloseAccountInfo;
