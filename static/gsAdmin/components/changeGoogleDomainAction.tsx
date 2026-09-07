import {Fragment, useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

type Props = {
  onUpdated: (data: any) => void;
  orgId: string;
};

const CHANGE_CHOICES = [
  {value: 'swap', label: 'Swap'},
  {value: 'add', label: 'Add'},
] as const;

const schema = z.object({
  newDomain: z.string().trim().min(1, 'New domain is required'),
  append: z
    .enum(['swap', 'add'])
    .nullable()
    .refine(value => value !== null, 'Change option is required'),
});

type ModalProps = Props & ModalRenderProps;

function ChangeGoogleDomainModal({
  Header,
  Body,
  Footer,
  closeModal,
  orgId,
  onUpdated,
}: ModalProps) {
  const [dryRun, setDryRun] = useState(true);
  const [dryRunInfo, setDryRunInfo] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async (data: {append: 'add' | 'swap'; newDomain: string}) => {
      const result: {
        dryrun_info: string[];
        new_domain: string;
      } = await fetchMutation({
        url: getApiUrl('/customers/$organizationIdOrSlug/migrate-google-domain/', {
          path: {organizationIdOrSlug: orgId},
        }),
        method: 'POST',
        data: {...data, dryRun},
      });
      return result;
    },
    onSuccess: result => {
      if (dryRun) {
        setDryRunInfo(result.dryrun_info);
        setDryRun(false);
        return;
      }

      closeModal();
      onUpdated({newDomain: result.new_domain});
    },
    onError: error => {
      closeModal();
      onUpdated({error});
    },
  });

  const defaultValues: z.input<typeof schema> = {newDomain: '', append: null};
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => mutation.mutateAsync(schema.parse(value)).catch(() => {}),
  });

  return (
    <Fragment>
      <form.AppForm form={form}>
        <Header>Change Google Domain</Header>
        <Body>
          <Stack gap="lg">
            <form.AppField name="newDomain">
              {field => (
                <field.Layout.Stack label="New Domain" required>
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder="new domain"
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="append">
              {field => (
                <field.Layout.Stack label="Change Option" required>
                  <field.Select
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={CHANGE_CHOICES}
                    placeholder="Choose an option"
                    disabled={mutation.isPending}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
            {dryRunInfo.length > 0 && (
              <Stack gap="sm">
                <Text bold>Test Run</Text>
                {dryRunInfo.map(info => (
                  <Text key={info} monospace wrap="pre-wrap">
                    {info}
                  </Text>
                ))}
              </Stack>
            )}
          </Stack>
        </Body>
        <Footer>
          <form.SubmitButton>
            {dryRun ? 'Do Dry Run' : 'Update Google Domain(s)'}
          </form.SubmitButton>
        </Footer>
      </form.AppForm>
    </Fragment>
  );
}

export const triggerGoogleDomainModal = (opts: Props) =>
  openModal(deps => <ChangeGoogleDomainModal {...deps} {...opts} />);
