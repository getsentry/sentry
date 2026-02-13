import {z} from 'zod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AutoSaveField} from '@sentry/scraps/form';

const stringSchema = z.object({
  name: z.string(),
});

const booleanSchema = z.object({
  enabled: z.boolean(),
});

const optionalBooleanSchema = z.object({
  enabled: z.boolean().optional(),
});

const nullableBooleanSchema = z.object({
  enabled: z.boolean().nullable(),
});

const refinedBooleanSchema = z.object({
  enabled: z
    .boolean()
    .nullable()
    .refine(b => b !== null, 'Boolean required'),
});

interface StringFieldProps {
  mutationFn: (data: {name: string}) => Promise<{name: string}>;
  initialValue?: string;
}

function StringFieldForm({mutationFn, initialValue = ''}: StringFieldProps) {
  return (
    <AutoSaveField
      name="name"
      schema={stringSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label="Name">
          <field.Input value={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

interface BooleanFieldProps {
  mutationFn: (data: {enabled: boolean}) => Promise<{enabled: boolean}>;
  initialValue?: boolean;
}

function BooleanFieldForm({mutationFn, initialValue = false}: BooleanFieldProps) {
  return (
    <AutoSaveField
      name="enabled"
      schema={booleanSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label="Enabled">
          <field.Switch checked={field.state.value} onChange={field.handleChange} />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

interface OptionalBooleanFieldProps {
  mutationFn: (data: {
    enabled: boolean | undefined;
  }) => Promise<{enabled: boolean | undefined}>;
  initialValue?: boolean;
}

function OptionalBooleanFieldForm({
  mutationFn,
  initialValue = false,
}: OptionalBooleanFieldProps) {
  return (
    <AutoSaveField
      name="enabled"
      schema={optionalBooleanSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label="Enabled">
          <field.Switch
            checked={field.state.value ?? false}
            onChange={field.handleChange}
          />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

interface NullableBooleanFieldProps {
  mutationFn: (data: {enabled: boolean | null}) => Promise<{enabled: boolean | null}>;
  initialValue?: boolean | null;
}

function NullableBooleanFieldForm({
  mutationFn,
  initialValue = false,
}: NullableBooleanFieldProps) {
  return (
    <AutoSaveField
      name="enabled"
      schema={nullableBooleanSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label="Enabled">
          <field.Switch
            checked={field.state.value ?? false}
            onChange={field.handleChange}
          />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

interface RefinedBooleanFieldProps {
  mutationFn: (data: {enabled: boolean}) => Promise<{enabled: boolean}>;
  initialValue?: boolean;
}

function RefinedBooleanFieldForm({
  mutationFn,
  initialValue = false,
}: RefinedBooleanFieldProps) {
  return (
    <AutoSaveField
      name="enabled"
      schema={refinedBooleanSchema}
      initialValue={initialValue}
      mutationOptions={{mutationFn}}
    >
      {field => (
        <field.Layout.Row label="Enabled">
          <field.Switch
            checked={field.state.value ?? false}
            onChange={field.handleChange}
          />
        </field.Layout.Row>
      )}
    </AutoSaveField>
  );
}

describe('AutoSaveField', () => {
  describe('string fields save on blur', () => {
    it('does not trigger mutation on change', async () => {
      const mutationFn = jest.fn((data: {name: string}) => Promise.resolve(data));

      render(<StringFieldForm mutationFn={mutationFn} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      // Mutation should not be called yet (only on blur)
      expect(mutationFn).not.toHaveBeenCalled();
    });

    it('triggers mutation on blur', async () => {
      const mutationFn = jest.fn((data: {name: string}) => Promise.resolve(data));

      render(<StringFieldForm mutationFn={mutationFn} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');
      await userEvent.tab();

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalledWith({name: 'test'});
      });
    });

    it('does not trigger mutation on blur if value unchanged', async () => {
      const mutationFn = jest.fn((data: {name: string}) => Promise.resolve(data));

      render(<StringFieldForm mutationFn={mutationFn} initialValue="initial" />);

      const input = screen.getByRole('textbox');
      input.focus();
      await userEvent.tab();

      // Wait a bit to ensure no mutation is triggered
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mutationFn).not.toHaveBeenCalled();
    });
  });

  describe('boolean fields save on change', () => {
    it('triggers mutation immediately on change', async () => {
      const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

      render(<BooleanFieldForm mutationFn={mutationFn} initialValue={false} />);

      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalledWith({enabled: true});
      });
    });

    it('does not require blur to trigger mutation', async () => {
      const mutationFn = jest.fn(() => new Promise<{enabled: boolean}>(() => {}));

      render(<BooleanFieldForm mutationFn={mutationFn} initialValue={false} />);

      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);

      // Mutation should be called immediately without blur
      expect(
        await screen.findByRole('status', {name: 'Saving enabled'})
      ).toBeInTheDocument();
    });
  });

  describe('optional boolean fields save on change', () => {
    it('triggers mutation immediately on change', async () => {
      const mutationFn = jest.fn((data: {enabled: boolean | undefined}) =>
        Promise.resolve(data)
      );

      render(<OptionalBooleanFieldForm mutationFn={mutationFn} initialValue={false} />);

      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalledWith({enabled: true});
      });
    });
  });

  describe('nullable boolean fields save on change', () => {
    it('triggers mutation immediately on change', async () => {
      const mutationFn = jest.fn((data: {enabled: boolean | null}) =>
        Promise.resolve(data)
      );

      render(<NullableBooleanFieldForm mutationFn={mutationFn} initialValue={false} />);

      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalledWith({enabled: true});
      });
    });
  });

  describe('refined boolean fields save on change', () => {
    it('triggers mutation immediately on change for refined boolean schemas', async () => {
      const mutationFn = jest.fn((data: {enabled: boolean}) => Promise.resolve(data));

      render(<RefinedBooleanFieldForm mutationFn={mutationFn} initialValue={false} />);

      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);

      await waitFor(() => {
        expect(mutationFn).toHaveBeenCalledWith({enabled: true});
      });
    });
  });
});
