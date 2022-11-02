import {render, screen} from 'sentry-test/reactTestingLibrary';

import JsonForm from 'sentry/components/forms/jsonForm';
import accountDetailsFields from 'sentry/data/forms/accountDetails';
import {fields} from 'sentry/data/forms/projectGeneralSettings';

const user = TestStubs.User();

describe('JsonForm', function () {
  describe('form prop', function () {
    it('default', function () {
      const {container} = render(
        <JsonForm forms={accountDetailsFields} additionalFieldProps={{user}} />
      );
      expect(container).toSnapshot();
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
      // @ts-expect-error TS(2322) FIXME: Type '((CustomType & BaseField) | ({ type: "select... Remove this comment to see the full error message
      const {container} = render(<JsonForm fields={jsonFormFields} />);
      expect(container).toSnapshot();
    });

    it('missing additionalFieldProps required in "valid" prop', function () {
      // eslint-disable-next-line no-console
      jest.spyOn(console, 'error').mockImplementation(jest.fn());
      try {
        render(
          <JsonForm
            // @ts-expect-error TS(2322) FIXME: Type '{ visible: ({ test }: any) => boolean; } | {... Remove this comment to see the full error message
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
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      render(<JsonForm title={accountDetailsFields[0].title} fields={jsonFormFields} />);

      expect(screen.getByText('Account Details')).toBeInTheDocument();
      expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('should NOT hide panel, if at least one field has visible set to true -  visible prop is of type boolean', function () {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
          title={accountDetailsFields[0].title}
          // @ts-expect-error TS(2322) FIXME: Type '({ visible: true; } | { visible: true; Compo... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
          title={accountDetailsFields[0].title}
          // @ts-expect-error TS(2322) FIXME: Type '({ visible: () => true; } | { visible: () =>... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
          title={accountDetailsFields[0].title}
          // @ts-expect-error TS(2322) FIXME: Type '({ visible: false; } | { visible: false; Com... Remove this comment to see the full error message
          fields={jsonFormFields.map(field => ({...field, visible: false}))}
        />
      );

      expect(screen.queryByText('Account Details')).not.toBeInTheDocument();
    });

    it('should ALWAYS hide panel, if all fields have visible set to false - visible prop is of type function', function () {
      // slug and platform have no visible prop, that means they will be always visible
      render(
        <JsonForm
          // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
          title={accountDetailsFields[0].title}
          // @ts-expect-error TS(2322) FIXME: Type '({ visible: () => false; } | { visible: () =... Remove this comment to see the full error message
          fields={jsonFormFields.map(field => ({...field, visible: () => false}))}
        />
      );

      expect(screen.queryByText('Account Details')).not.toBeInTheDocument();
    });
  });
});
