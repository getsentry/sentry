import React from 'react';
import {mount} from 'enzyme';

import NewOrganizationSettingsForm from 'app/views/settings/organization/general/organizationSettingsForm';
import {saveOnBlurUndoMessage} from 'app/actionCreators/indicator';

jest.mock('jquery');
jest.mock('app/actionCreators/indicator');

describe('OrganizationSettingsForm', function() {
  let organization = TestStubs.Organization();
  let putMock;
  let onSave = jest.fn();

  beforeEach(function() {
    MockApiClient.clearMockResponses();
    onSave.mockReset();
  });

  it('can change a form field', function(done) {
    putMock = MockApiClient.addMockResponse({
      url: '/organizations/3/',
      method: 'PUT',
      data: {
        name: 'New Name',
      },
    });

    let wrapper = mount(
      <NewOrganizationSettingsForm
        location={TestStubs.location()}
        orgId={organization.id}
        access={new Set('org:admin')}
        initialData={TestStubs.Organization()}
        onSave={onSave}
      />,
      TestStubs.routerContext()
    );

    let input = wrapper.find('input[name="name"]');
    expect(input).toHaveLength(1);

    input.simulate('change', {target: {value: 'New Name'}});
    input.simulate('blur');

    expect(putMock).toHaveBeenCalledWith(
      '/organizations/3/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          name: 'New Name',
        },
      })
    );

    saveOnBlurUndoMessage.mockImplementation(function(change, model, fieldName) {
      try {
        expect(fieldName).toBe('name');
        expect(change.old).toBe('Organization Name');
        expect(change.new).toBe('New Name');

        // Test "undo" call undo directly
        expect(model.getValue('name')).toBe('New Name');
        model.undo();
        expect(model.getValue('name')).toBe('Organization Name');
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});
