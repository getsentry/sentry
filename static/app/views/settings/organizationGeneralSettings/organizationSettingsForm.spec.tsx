import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicatorActions from 'sentry/actionCreators/indicator';
import Indicators from 'sentry/components/indicators';
import OrganizationSettingsForm from 'sentry/views/settings/organizationGeneralSettings/organizationSettingsForm';

jest.mock('sentry/actionCreators/indicator');

describe('OrganizationSettingsForm', function () {
  const {organization, routerProps} = initializeOrg();
  let putMock: jest.Mock;
  const onSave = jest.fn();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?provider_key=github`,
      method: 'GET',
      body: {
        providers: [{canAdd: true}],
      },
    });
    onSave.mockReset();
  });

  it('can change a form field', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={Organization()}
        onSave={onSave}
      />
    );

    render(<Indicators />);

    const input = screen.getByRole('textbox', {name: 'Display Name'});

    const saveOnBlur = jest.spyOn(indicatorActions, 'saveOnBlurUndoMessage');

    await userEvent.clear(input);
    await userEvent.type(input, 'New Name');
    await userEvent.tab();

    expect(putMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({
        method: 'PUT',
        data: {
          name: 'New Name',
        },
      })
    );

    expect(saveOnBlur).toHaveBeenCalledWith(
      {
        new: 'New Name',
        old: 'Organization Name',
      },
      expect.anything(),
      'name'
    );

    const model = saveOnBlur.mock.calls[0][1];

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
    await userEvent.click(input);
    await userEvent.tab();

    expect(putMock).not.toHaveBeenCalled();
  });

  it('can change slug', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: organization,
    });

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={Organization()}
        onSave={onSave}
      />
    );

    const input = screen.getByRole('textbox', {name: 'Organization Slug'});

    await userEvent.clear(input);
    await userEvent.type(input, 'NEW SLUG');
    await userEvent.tab();

    expect(putMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(putMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        data: {
          slug: 'new-slug',
        },
      })
    );
  });

  it('can enable codecov', async function () {
    putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, codecovAccess: true},
    });

    render(
      <OrganizationSettingsForm
        {...routerProps}
        initialData={Organization({codecovAccess: false})}
        onSave={onSave}
      />,
      {
        organization: {
          ...organization,
          features: ['codecov-integration'],
        },
      }
    );

    await userEvent.click(
      screen.getByRole('checkbox', {name: /Enable Code Coverage Insights/})
    );

    expect(putMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        data: {
          codecovAccess: true,
        },
      })
    );
  });
});
