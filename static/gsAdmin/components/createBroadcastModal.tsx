import {useMutation} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Field} from 'sentry/components/forms/types';
import type {Broadcast} from 'sentry/types/system';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useNavigate} from 'sentry/utils/useNavigate';

interface CreateBroadcastModalProps extends ModalRenderProps {
  fields: Field[];
}

type FormValue = string | string[] | boolean | null;
type FormValues = Record<string, FormValue>;

export function CreateBroadcastModal({
  Header,
  Body,
  Footer,
  closeModal,
  fields,
}: CreateBroadcastModalProps) {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (data: Partial<Broadcast>) =>
      fetchMutation<Broadcast>({
        url: getApiUrl('/broadcasts/'),
        method: 'POST',
        data,
      }),
    onSuccess: data => navigate(`/_admin/broadcasts/${data.id}/`),
    onError: () => addErrorMessage('An error occurred while submitting this form.'),
  });

  const defaultValues: FormValues = Object.fromEntries(
    fields.map(field => [
      field.name,
      field.type === 'boolean'
        ? false
        : field.type === 'choice' && 'multiple' in field && field.multiple
          ? []
          : '',
    ])
  );
  defaultValues.isActive = true;
  defaultValues.dateExpires = moment().add(7, 'days').format('YYYY-MM-DDTHH:mm');

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    onSubmit: ({value}) => {
      const errors: Record<string, {message: string}> = {};
      for (const field of fields) {
        if (field.required && !value[field.name]) {
          errors[field.name] = {message: 'This field is required'};
        }
      }
      if (!safeURL(String(value.link ?? ''))) {
        errors.link = {message: 'Invalid URL'};
      }
      if (value.mediaUrl && !safeURL(String(value.mediaUrl))) {
        errors.mediaUrl = {message: 'Invalid image URL'};
      }
      if (Object.keys(errors).length) {
        setFieldErrors(form, errors);
        return;
      }

      const payload = {
        ...value,
        category: value.category || undefined,
        mediaUrl: value.mediaUrl || undefined,
        region: value.region || undefined,
        organizations: value.organizations
          ? String(value.organizations)
              .split(',')
              .map(s => Number(s.trim()))
              .filter(n => n > 0)
          : undefined,
      } as Partial<Broadcast>;
      return mutation.mutateAsync(payload).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">Add Broadcast</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          {fields.map(config => (
            <form.AppField key={config.name} name={config.name}>
              {field => {
                const label =
                  typeof config.label === 'string' ? config.label : config.name;
                const hintText =
                  typeof config.help === 'string' ? config.help : undefined;
                const currentValue = field.state.value;
                if (config.type === 'boolean') {
                  return (
                    <field.Layout.Row label={label} hintText={hintText}>
                      <field.Switch
                        checked={Boolean(currentValue)}
                        onChange={field.handleChange}
                      />
                    </field.Layout.Row>
                  );
                }
                if (config.type === 'choice') {
                  const options = 'options' in config ? (config.options ?? []) : [];
                  if ('multiple' in config && config.multiple) {
                    return (
                      <field.Layout.Stack label={label} hintText={hintText}>
                        <field.Select
                          multiple
                          value={Array.isArray(currentValue) ? currentValue : []}
                          onChange={field.handleChange}
                          options={options}
                        />
                      </field.Layout.Stack>
                    );
                  }
                  return (
                    <field.Layout.Stack label={label} hintText={hintText}>
                      <field.Select
                        value={typeof currentValue === 'string' ? currentValue : null}
                        onChange={field.handleChange}
                        options={options}
                        clearable
                      />
                    </field.Layout.Stack>
                  );
                }
                return (
                  <field.Layout.Stack
                    label={label}
                    hintText={hintText}
                    required={config.required}
                  >
                    <field.Input
                      type={config.type === 'datetime' ? 'datetime-local' : 'text'}
                      value={typeof currentValue === 'string' ? currentValue : ''}
                      onChange={field.handleChange}
                      placeholder={
                        typeof config.placeholder === 'string'
                          ? config.placeholder
                          : undefined
                      }
                      maxLength={'maxLength' in config ? config.maxLength : undefined}
                    />
                  </field.Layout.Stack>
                );
              }}
            </form.AppField>
          ))}
        </Stack>
      </Body>
      <Footer>
        <Button onClick={closeModal}>Cancel</Button>
        <form.SubmitButton>Save</form.SubmitButton>
      </Footer>
    </form.AppForm>
  );
}
