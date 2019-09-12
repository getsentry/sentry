import {Modal} from 'react-bootstrap';
import {browserHistory} from 'react-router';
import React from 'react';

import {mount} from 'enzyme';
import CreateIncidentModal from 'app/components/modals/createIncidentModal';

describe('CreateIncidentModal', function() {
  const org = TestStubs.Organization();
  const closeModal = jest.fn();
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(function() {
    onClose.mockReset();
    onSuccess.mockReset();
  });

  afterEach(function() {
    browserHistory.push.mockReset();
  });

  it('creates and redirects to newly created incident', async function() {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/incidents/',
      method: 'POST',
      body: {
        identifier: '11111',
      },
    });
    const wrapper = mount(
      <CreateIncidentModal
        Body={Modal.Body}
        Header={Modal.Header}
        organization={org}
        closeModal={closeModal}
        onClose={onClose}
        issues={['123', '456']}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('Input[name="title"]').simulate('change', {target: {value: 'Oh no'}});

    wrapper.find('Form').simulate('submit');

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/',
      expect.objectContaining({
        data: {
          groups: ['123', '456'],
          query: '',
          title: 'Oh no',
        },
        method: 'POST',
      })
    );
    await tick();
    expect(onClose).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();

    expect(browserHistory.push).toHaveBeenCalledWith(
      '/organizations/org-slug/incidents/11111/'
    );
  });
});
