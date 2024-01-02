import {User} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import JsonForm from 'sentry/components/forms/jsonForm';
import accountDetailsFields from 'sentry/data/forms/accountDetails';
import {fields} from 'sentry/data/forms/projectGeneralSettings';

import {JsonFormObject} from './types';

const user = User();

describe('JsonForm', function () {
  describe('form prop', function () {
    it('default', function () {
      render(<JsonForm forms={accountDetailsFields} additionalFieldProps={{user}} />);
    });

    it('initiallyCollapsed json form prop collapses forms', function () {
      const forms: JsonFormObject[] = [
        {
          title: 'Form1 title',
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              label: 'Field Label 1 ',
              placeholder: 'e.g. John Doe',
            },
          ],
        },
        {
          title: 'Form2 title',
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              label: 'Field Label 2',
              placeholder: 'e.g. Abdullah Khan',
            },
          ],
        },
      ];
      render(
        <JsonForm
          forms={forms}
          additionalFieldProps={{user}}
          collapsible
          initiallyCollapsed
        />
      );

      expect(screen.getByText('Form1 title')).toBeInTheDocument();
      expect(screen.getByText('Form2 title')).toBeInTheDocument();

      expect(screen.queryByText('Field Label 1')).not.toBeVisible();
      expect(screen.queryByText('Field Label 2')).not.toBeVisible();
    });

    it('initiallyCollapsed prop from children form groups override json form initiallyCollapsed prop', function () {
      const forms: JsonFormObject[] = [
        {
          title: 'Form1 title',
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              label: 'Field Label 1 ',
              placeholder: 'e.g. John Doe',
            },
          ],
        },
        {
          title: 'Form2 title',
          fields: [
            {
              name: 'name',
              type: 'string',
              required: true,
              label: 'Field Label 2',
              placeholder: 'e.g. Abdullah Khan',
            },
          ],
          initiallyCollapsed: false, // Prevents this form group from being collapsed
        },
      ];
      render(
        <JsonForm
          forms={forms}
          additionalFieldProps={{user}}
          collapsible
          initiallyCollapsed
        />
      );

      expect(screen.getByText('Form1 title')).toBeInTheDocument();
      expect(screen.getByText('Form2 title')).toBeInTheDocument();

      expect(screen.queryByText('Field Label 1')).not.toBeVisible();
      expect(screen.queryByText('Field Label 2')).toBeVisible();
    });

    it('missing additionalFieldProps required in "valid" prop', function () {
      // eslint-disable-next-line no-console
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      try {
        render(<JsonForm forms={accountDetailsFields} />);
      } catch (error) {
        expect(error.message).toBe(
          "Cannot read properties of undefined (reading 'email')"
        );
      }
    });

    it('should ALWAYS hide panel, if all fields have visible set to false  AND there is no renderHeader & renderFooter -  visible prop is of type boolean', function () {
      const modifiedAccountDetails = accountDetailsFields.map(accountDetailsField => ({
        ...accountDetailsField,
        fields: accountDetailsField.fields.map(field => ({...field, visible: false})),
      }));

      render(<JsonForm forms={modifiedAccountDetails} additionalFieldProps={{user}} />);

      expect(screen.queryByText('Account Details')).not.toBeInTheDocument();
    });

    it('should ALWAYS hide panel, if all fields have visible set to false AND there is no renderHeader & renderFooter -  visible prop is of type func', function () {
      const modifiedAccountDetails = accountDetailsFields.map(accountDetailsField => ({
        ...accountDetailsField,
        fields: accountDetailsField.fields.map(field => ({
          ...field,
          visible: () => false,
        })),
      }));

      render(<JsonForm forms={modifiedAccountDetails} additionalFieldProps={{user}} />);

      expect(screen.queryByText('Account Details')).not.toBeInTheDocument();
    });

    it('should NOT hide panel, if at least one field has visible set to true -  no visible prop (1 field) + visible prop is of type func (2 field)', function () {
      // accountDetailsFields has two fields. The second field will always have visible set to false, because the username and the email are the same 'foo@example.com'
      render(<JsonForm forms={accountDetailsFields} additionalFieldProps={{user}} />);

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should NOT hide panel, if all fields have visible set to false AND a prop renderHeader is passed', function () {
      const modifiedAccountDetails = accountDetailsFields.map(accountDetailsField => ({
        ...accountDetailsField,
        fields: accountDetailsField.fields.map(field => ({...field, visible: false})),
      }));

      render(
        <JsonForm
          forms={modifiedAccountDetails}
          additionalFieldProps={{user}}
          renderHeader={() => <div>this is a Header </div>}
        />
      );

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('fields prop', function () {
    const jsonFormFields = [fields.name, fields.platform];

    it('default', function () {
      render(<JsonForm fields={jsonFormFields} />);
    });

    it('missing additionalFieldProps required in "valid" prop', function () {
      // eslint-disable-next-line no-console
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      try {
        render(
          <JsonForm
            fields={[{...jsonFormFields[0], visible: ({test}) => !!test.email}]}
          />
        );
      } catch (error) {
        expect(error.message).toBe(
          "Cannot read properties of undefined (reading 'email')"
        );
      }
    });

    it('should NOT hide panel, if at least one field has visible set to true - no visible prop', function () {
      // slug and platform have no visible prop, that means they will be always visible
      render(<JsonForm title={accountDetailsFields[0].title} fields={jsonFormFields} />);

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('should NOT hide panel, if at least one field has visible set to true -  visible prop is of type boolean', function () {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title={accountDetailsFields[0].title}
          fields={jsonFormFields.map(field => ({...field, visible: true}))}
        />
      );

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('should NOT hide panel, if at least one field has visible set to true -  visible prop is of type func', function () {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title={accountDetailsFields[0].title}
          fields={jsonFormFields.map(field => ({...field, visible: () => true}))}
        />
      );

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('should ALWAYS hide panel, if all fields have visible set to false -  visible prop is of type boolean', function () {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title={accountDetailsFields[0].title}
          fields={jsonFormFields.map(field => ({...field, visible: false}))}
        />
      );

      expect(screen.queryByText('Account Details')).not.toBeInTheDocument();
    });

    it('should ALWAYS hide panel, if all fields have visible set to false - visible prop is of type function', function () {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title={accountDetailsFields[0].title}
          fields={jsonFormFields.map(field => ({...field, visible: () => false}))}
        />
      );

      expect(screen.queryByText('Account Details')).not.toBeInTheDocument();
    });
  });
});
