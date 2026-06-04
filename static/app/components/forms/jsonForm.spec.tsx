import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import JsonForm from 'sentry/components/forms/jsonForm';
import {fields} from 'sentry/data/forms/projectGeneralSettings';

import type {FieldObject, JsonFormObject} from './types';

const user = UserFixture();

const testFormFields: JsonFormObject[] = [
  {
    title: 'Test Form',
    fields: [
      {
        name: 'testField',
        type: 'string',
        required: true,
        label: 'Test Field',
        placeholder: 'e.g. Test Value',
      },
    ],
  },
];

describe('JsonForm', () => {
  describe('form prop', () => {
    it('default', () => {
      render(<JsonForm forms={testFormFields} />);
    });

    it('initiallyCollapsed json form prop collapses forms', () => {
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

    it('initiallyCollapsed prop from children form groups override json form initiallyCollapsed prop', () => {
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

    it('should ALWAYS hide panel, if all fields have visible set to false AND there is no renderHeader & renderFooter', () => {
      const hiddenFields: JsonFormObject[] = [
        {
          title: 'Hidden Form',
          fields: [
            {
              name: 'hiddenField',
              type: 'string',
              label: 'Hidden Field',
              visible: false,
            },
          ],
        },
      ];

      render(<JsonForm forms={hiddenFields} />);

      expect(screen.queryByText('Hidden Form')).not.toBeInTheDocument();
    });

    it('should NOT hide panel, if at least one field has visible set to true', () => {
      render(<JsonForm forms={testFormFields} />);

      expect(screen.getByText('Test Form')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should NOT hide panel, if all fields have visible set to false AND a prop renderHeader is passed', () => {
      const hiddenFields: JsonFormObject[] = [
        {
          title: 'Form With Header',
          fields: [
            {
              name: 'hiddenField',
              type: 'string',
              label: 'Hidden Field',
              visible: false,
            },
          ],
        },
      ];

      render(
        <JsonForm
          forms={hiddenFields}
          renderHeader={() => <div>this is a Header </div>}
        />
      );

      expect(screen.getByText('Form With Header')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('fields prop', () => {
    const jsonFormFields = [fields.slug, fields.platform] as FieldObject[];

    it('default', () => {
      render(<JsonForm fields={jsonFormFields} />);
    });

    it('missing additionalFieldProps required in "valid" prop', () => {
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      expect(() =>
        render(
          <JsonForm
            fields={[
              {...jsonFormFields[0]!, visible: ({test}) => !!test.email} as FieldObject,
            ]}
          />
        )
      ).toThrow("Cannot read properties of undefined (reading 'email')");
    });

    it('should NOT hide panel, if at least one field has visible set to true - no visible prop', () => {
      // slug and platform have no visible prop, that means they will be always visible
      render(<JsonForm title="Test Form Title" fields={jsonFormFields} />);

      expect(screen.getByText('Test Form Title')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('should NOT hide panel, if at least one field has visible set to true -  visible prop is of type boolean', () => {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title="Test Form Title"
          fields={jsonFormFields.map(field => ({...field, visible: true}) as FieldObject)}
        />
      );

      expect(screen.getByText('Test Form Title')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('should NOT hide panel, if at least one field has visible set to true -  visible prop is of type func', () => {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title="Test Form Title"
          fields={jsonFormFields.map(
            field => ({...field, visible: () => true}) as FieldObject
          )}
        />
      );

      expect(screen.getByText('Test Form Title')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('should ALWAYS hide panel, if all fields have visible set to false -  visible prop is of type boolean', () => {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title="Test Form Title"
          fields={jsonFormFields.map(
            field => ({...field, visible: false}) as FieldObject
          )}
        />
      );

      expect(screen.queryByText('Test Form Title')).not.toBeInTheDocument();
    });

    it('should ALWAYS hide panel, if all fields have visible set to false - visible prop is of type function', () => {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          title="Test Form Title"
          fields={jsonFormFields.map(
            field => ({...field, visible: () => false}) as FieldObject
          )}
        />
      );

      expect(screen.queryByText('Test Form Title')).not.toBeInTheDocument();
    });
  });
});
