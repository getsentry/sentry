import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import FormSource, {
  setSearchMap,
  type FormSearchField,
} from 'sentry/components/search/sources/formSource';
import * as accountDetailsForm from 'sentry/data/forms/accountDetails';
import * as organizationGeneralSettingsForm from 'sentry/data/forms/organizationGeneralSettings';
import * as teamSettingsFieldsForm from 'sentry/data/forms/teamSettingsFields';

describe('FormSource', () => {
  const searchMap: FormSearchField[] = [
    {
      title: 'Test Field',
      description: 'test-help',
      route: '/route/',
      field: {
        name: 'test-field',
        label: 'Test Field',
        help: 'test-help',
        type: 'text',
      },
    },
    {
      title: 'Foo Field',
      description: 'foo-help',
      route: '/foo/',
      field: {
        name: 'foo-field',
        label: 'Foo Field',
        help: 'foo-help',
        type: 'text',
      },
    },
  ];

  beforeEach(() => {
    setSearchMap(searchMap);
  });

  it('can find a form field', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(<FormSource query="te">{mock}</FormSource>);

    await waitFor(() =>
      expect(mock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          results: [
            expect.objectContaining({
              item: {
                field: {
                  label: 'Test Field',
                  name: 'test-field',
                  help: 'test-help',
                  type: 'text',
                },
                title: 'Test Field',
                description: 'test-help',
                route: '/route/',
                resultType: 'field',
                sourceType: 'field',
                to: {pathname: '/route/', hash: '#test-field'},
                resolvedTs: expect.anything(),
              },
            }),
          ],
        })
      )
    );
  });

  it('does not find any form field', async () => {
    const mock = jest.fn().mockReturnValue(null);
    render(<FormSource query="invalid">{mock}</FormSource>);

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith({
        isLoading: false,
        results: [],
      })
    );
  });

  describe('factory forms invocation', () => {
    it('accountDetails factory returns form with userId field when invoked with includeUserId', () => {
      const result = accountDetailsForm.createAccountDetailsForm({
        includeUserId: true,
        user: {id: 'test-user-id'} as any,
      });

      expect(result[0]?.fields).toBeDefined();
      const fields = result[0]!.fields;
      const userIdField = fields.find(
        field => typeof field !== 'function' && field.name === 'userId'
      );

      expect(userIdField).toBeDefined();
      expect(userIdField).toMatchObject({
        name: 'userId',
        type: 'string',
        label: 'User ID',
      });
    });

    it('organizationGeneralSettings factory returns form with factory-added fields', () => {
      const result =
        organizationGeneralSettingsForm.createOrganizationGeneralSettingsForm({
          organization: {
            id: 'test-org-id',
            features: ['gen-ai-features', 'codecov-integration'],
          } as any,
          access: new Set(['org:write']),
        });

      expect(result[0]?.fields).toBeDefined();
      const fields = result[0]!.fields;

      // Check for organizationId field
      const organizationIdField = fields.find(
        field => typeof field !== 'function' && field.name === 'organizationId'
      );
      expect(organizationIdField).toBeDefined();
      expect(organizationIdField).toMatchObject({
        name: 'organizationId',
        type: 'string',
        label: 'Organization ID',
      });

      // Check for AI-related fields
      const hideAiFeaturesField = fields.find(
        field => typeof field !== 'function' && field.name === 'hideAiFeatures'
      );
      expect(hideAiFeaturesField).toBeDefined();

      const codecovField = fields.find(
        field => typeof field !== 'function' && field.name === 'codecovAccess'
      );
      expect(codecovField).toBeDefined();
    });

    it('teamSettingsFields factory returns form with teamId field when invoked with includeTeamId', () => {
      const result = teamSettingsFieldsForm.createTeamSettingsForm({
        includeTeamId: true,
        team: {id: 'test-team-id'} as any,
      });

      expect(result[0]?.fields).toBeDefined();
      const fields = result[0]!.fields;
      const teamIdField = fields.find(
        field => typeof field !== 'function' && field.name === 'teamId'
      );

      expect(teamIdField).toBeDefined();
      expect(teamIdField).toMatchObject({
        name: 'teamId',
        type: 'string',
        label: 'Team ID',
      });
    });

    it('can search and find factory-added fields', async () => {
      // Create a search map with factory-added fields
      const factoryFieldsSearchMap: FormSearchField[] = [
        {
          title: 'User ID',
          description: 'The unique identifier for your account. It cannot be modified.',
          route: '/settings/account/details/',
          field: {
            name: 'userId',
            label: 'User ID',
            help: 'The unique identifier for your account. It cannot be modified.',
            type: 'string',
          },
        },
        {
          title: 'Organization ID',
          description:
            'The unique identifier for this organization. It cannot be modified.',
          route: '/settings/:orgId/',
          field: {
            name: 'organizationId',
            label: 'Organization ID',
            help: 'The unique identifier for this organization. It cannot be modified.',
            type: 'string',
          },
        },
        {
          title: 'Team ID',
          description: 'The unique identifier for this team. It cannot be modified.',
          route: '/settings/:orgId/teams/:teamId/settings/',
          field: {
            name: 'teamId',
            label: 'Team ID',
            help: 'The unique identifier for this team. It cannot be modified.',
            type: 'string',
          },
        },
      ];

      setSearchMap(factoryFieldsSearchMap);

      const mock = jest.fn().mockReturnValue(null);
      render(<FormSource query="user id">{mock}</FormSource>);

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            results: expect.arrayContaining([
              expect.objectContaining({
                item: expect.objectContaining({
                  field: expect.objectContaining({
                    name: 'userId',
                    label: 'User ID',
                  }),
                  title: 'User ID',
                }),
              }),
            ]),
          })
        )
      );
    });
  });
});
