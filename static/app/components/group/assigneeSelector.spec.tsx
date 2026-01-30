import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as groupActionCreators from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useHandleAssigneeChange} from 'sentry/components/group/assigneeSelector';
import type RequestError from 'sentry/utils/requestError/requestError';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/actionCreators/group');

describe('useHandleAssigneeChange', () => {
  const group = GroupFixture({id: '1337'});
  const organization = OrganizationFixture();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows specific error message when assignee update fails with permission error', async () => {
    const permissionError: Partial<RequestError> = {
      responseJSON: {
        assignedTo: 'You do not have permission to assign this owner',
      },
    };

    jest
      .spyOn(groupActionCreators, 'assignToActor')
      .mockRejectedValue(permissionError);

    const {result} = renderHookWithProviders(() =>
      useHandleAssigneeChange({
        group,
        organization,
      })
    );

    result.current.handleAssigneeChange({
      id: '123',
      name: 'Test User',
      type: 'user',
      assignee: {id: '123', name: 'Test User', type: 'user'},
    });

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith(
        'You do not have permission to assign this owner'
      );
    });
  });

  it('shows generic error message when assignee update fails without specific error', async () => {
    const genericError: Partial<RequestError> = {
      responseJSON: {},
    };

    jest
      .spyOn(groupActionCreators, 'assignToActor')
      .mockRejectedValue(genericError);

    const {result} = renderHookWithProviders(() =>
      useHandleAssigneeChange({
        group,
        organization,
      })
    );

    result.current.handleAssigneeChange({
      id: '123',
      name: 'Test User',
      type: 'user',
      assignee: {id: '123', name: 'Test User', type: 'user'},
    });

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Failed to update assignee');
    });
  });
});
