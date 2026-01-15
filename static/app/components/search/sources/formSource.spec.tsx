import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import * as accountDetailsForm from 'sentry/data/forms/accountDetails';
import * as organizationGeneralSettingsForm from 'sentry/data/forms/organizationGeneralSettings';
import * as teamSettingsFieldsForm from 'sentry/data/forms/teamSettingsFields';

describe('FormSource', () => {
  const user = UserFixture();
  const organization = OrganizationFixture();

  describe('factory forms', () => {
    const searchContext: accountDetailsForm.FormSearchContext = {
      user,
      organization,
      access: new Set(['org:write']),
    };

    it('creates accountDetails form with userId field', () => {
      const result = accountDetailsForm.createAccountDetailsForm(searchContext);
      const fields = result[0]?.fields;

      expect(fields).toBeDefined();

      const userIdField = fields?.find(
        field => typeof field !== 'function' && field.name === 'userId'
      );

      expect(userIdField).toMatchObject({
        name: 'userId',
        type: 'string',
        label: 'User ID',
      });
    });

    it('creates organizationGeneralSettings form with factory-added fields', () => {
      const result =
        organizationGeneralSettingsForm.createOrganizationGeneralSettingsForm(
          searchContext
        );
      const fields = result[0]?.fields;

      expect(fields).toBeDefined();

      const organizationIdField = fields?.find(
        field => typeof field !== 'function' && field.name === 'organizationId'
      );
      expect(organizationIdField).toMatchObject({
        name: 'organizationId',
        type: 'string',
        label: 'Organization ID',
      });

      const hideAiFeaturesField = fields?.find(
        field => typeof field !== 'function' && field.name === 'hideAiFeatures'
      );
      expect(hideAiFeaturesField).toBeDefined();

      const codecovField = fields?.find(
        field => typeof field !== 'function' && field.name === 'codecovAccess'
      );
      expect(codecovField).toBeDefined();
    });

    it('creates teamSettingsFields form with teamId field', () => {
      const result = teamSettingsFieldsForm.createTeamSettingsForm(searchContext);
      const fields = result[0]?.fields;

      expect(fields).toBeDefined();

      const teamIdField = fields?.find(
        field => typeof field !== 'function' && field.name === 'teamId'
      );

      expect(teamIdField).toMatchObject({
        name: 'teamId',
        type: 'string',
        label: 'Team ID',
      });
    });
  });
});
