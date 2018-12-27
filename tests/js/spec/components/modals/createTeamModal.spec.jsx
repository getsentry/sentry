import {Modal} from 'react-bootstrap';
import React from 'react';

import {createTeam} from 'app/actionCreators/teams';
import {mount} from 'enzyme';
import CreateTeamModal from 'app/components/modals/createTeamModal';

jest.mock('app/actionCreators/teams', () => ({
  createTeam: jest.fn((...args) => new Promise(resolve => resolve(...args))),
}));

describe('CreateTeamModal', function() {
  let org = TestStubs.Organization();
  let closeModal = jest.fn();
  let onClose = jest.fn();
  let onSuccess = jest.fn();

  beforeEach(function() {
    onClose.mockReset();
    onSuccess.mockReset();
  });

  afterEach(function() {});

  it('calls createTeam action creator on submit', async function() {
    let wrapper = mount(
      <CreateTeamModal
        Body={Modal.Body}
        Header={Modal.Header}
        organization={org}
        closeModal={closeModal}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
      TestStubs.routerContext()
    );

    wrapper
      .find('CreateTeamForm Input[name="slug"]')
      .simulate('change', {e: {target: {value: 'new-team'}}});

    wrapper.find('CreateTeamForm Form').simulate('submit');

    expect(createTeam).toHaveBeenCalledTimes(1);
    await tick();
    expect(onClose).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
