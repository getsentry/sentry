import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {saveOnBlurUndoMessage} from 'sentry/actionCreators/indicator';
import Indicators from 'sentry/components/indicators';
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

  it('can change a form field', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    render(
      <OrganizationSettingsForm
        location={TestStubs.location()}
        orgId={organization.slug}
        access={new Set(['org:write'])}
        initialData={TestStubs.Organization()}
        onSave={onSave}
      />
    );

    render(<Indicators />);

    const input = screen.getByRole('textbox', {name: 'Display Name'});

    userEvent.clear(input);
    userEvent.type(input, 'New Name');
    userEvent.tab();

    expect(putMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          name: 'New Name',
        },
      })
    );

    await new Promise(resolve => {
      saveOnBlurUndoMessage.mockImplementationOnce(async function (
        change,
        model,
        fieldName
      ) {
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
        userEvent.click(input);
        userEvent.tab();

        expect(putMock).not.toHaveBeenCalled();
        resolve();
      });
    });
  });

  it('can change slug', function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    render(
      <OrganizationSettingsForm
        location={TestStubs.location()}
        orgId={organization.slug}
        access={new Set(['org:write'])}
        initialData={TestStubs.Organization()}
        onSave={onSave}
      />
    );

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});

    userEvent.clear(input);
    userEvent.type(input, 'NEW SLUG');
    userEvent.tab();

    expect(putMock).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button', {name: 'Save'}));

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
