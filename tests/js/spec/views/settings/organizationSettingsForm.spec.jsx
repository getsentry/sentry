import {mountWithTheme} from 'sentry-test/enzyme';

import {saveOnBlurUndoMessage} from 'sentry/actionCreators/indicator';
import OrganizationSettingsForm from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

jest.mock('sentry/actionCreators/indicator');

describe('OrganizationSettingsForm', function () {
  const organization = TestStubs.Organization();
  let putMock;
  const onSave = jest.fn();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
    });
    onSave.mockReset();
  });

  it('can change a form field', function (done) {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      data: {
        name: 'New Name',
      },
    });

    const wrapper = mountWithTheme(
      <OrganizationSettingsForm
        location={TestStubs.location()}
        orgId={organization.slug}
        access={new Set('org:admin')}
        initialData={TestStubs.Organization()}
        onSave={onSave}
      />
    );

    const input = wrapper.find('input[name="name"]');
    expect(input).toHaveLength(1);

    input.simulate('change', {target: {value: 'New Name'}});
    input.simulate('blur');

    expect(putMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          name: 'New Name',
        },
      })
    );

    saveOnBlurUndoMessage.mockImplementationOnce(async function (
      change,
      model,
      fieldName
    ) {
      try {
        expect(fieldName).toBe('name');
        expect(change.old).toBe('Organization Name');
        expect(change.new).toBe('New Name');

        // Test "undo" call undo directly
        expect(model.getValue('name')).toBe('New Name');
        model.undo();
        expect(model.getValue('name')).toBe('Organization Name');

        // `saveOnBlurUndoMessage` saves the new field, so reimplement this
        await model.saveField('name', 'Organization Name');

        // Initial data should be updated to original name
        expect(model.initialData.name).toBe('Organization Name');

        putMock.mockReset();
        // Blurring the name field again should NOT trigger a save
        input.simulate('blur');
        expect(putMock).not.toHaveBeenCalled();
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  it('can change slug', function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <OrganizationSettingsForm
        location={TestStubs.location()}
        orgId={organization.slug}
        access={new Set('org:admin')}
        initialData={TestStubs.Organization()}
        onSave={onSave}
      />
    );

    wrapper
      .find('input[name="slug"]')
      .simulate('change', {target: {value: 'NEW SLUG'}})
      .simulate('blur');

    expect(putMock).not.toHaveBeenCalled();

    wrapper.find('button[aria-label="Save"]').simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );
  });
});
