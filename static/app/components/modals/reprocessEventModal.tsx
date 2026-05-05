import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

export type ReprocessEventModalOptions = {
  groupId: Group['id'];
  organization: Organization;
};

const schema = z.object({
  maxEvents: z
    .string()
    .refine(
      v => v === '' || (/^\d+$/.test(v) && Number(v) >= 1),
      t('Must be a positive integer')
    ),
  remainingEvents: z.enum(['keep', 'delete']),
});

type FormValues = z.infer<typeof schema>;

export function ReprocessingEventModal({
  Header,
  Body,
  Footer,
  organization,
  closeModal,
  groupId,
}: ModalRenderProps & ReprocessEventModalOptions) {
  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: {remainingEvents: 'keep' | 'delete'; maxEvents?: number} = {
        remainingEvents: data.remainingEvents,
      };
      if (data.maxEvents !== '') {
        payload.maxEvents = Number(data.maxEvents);
      }
      return fetchMutation({
        url: `/organizations/${organization.slug}/issues/${groupId}/reprocessing/`,
        method: 'POST',
        data: payload,
      });
    },
  });

  const defaultValues: FormValues = {maxEvents: '', remainingEvents: 'keep'};

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) =>
      mutation
        .mutateAsync(value)
        .then(() => {
          closeModal();
          testableWindowLocation.reload();
        })
        .catch(error => {
          const handled =
            error instanceof RequestError ? setFieldErrors(formApi, error) : false;
          if (!handled) {
            addErrorMessage(t('Failed to reprocess. Please check your input.'));
          }
        }),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <h4>{t('Reprocess Events')}</h4>
      </Header>
      <Body>
        <Introduction>
          {t(
            'Reprocessing applies new debug files and grouping enhancements to this Issue. Please consider these impacts:'
          )}
        </Introduction>
        <StyledList symbol="bullet">
          <ListItem>
            {tct(
              "[strong:Quota applies.] Every event you choose to reprocess counts against your plan's quota. Rate limits and spike protection do not apply.",
              {strong: <strong />}
            )}
          </ListItem>
          <ListItem>
            {tct(
              '[strong:Attachment storage required.] If your events come from minidumps or unreal crash reports, you must have [link:attachment storage] enabled.',
              {
                strong: <strong />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/native/enriching-events/attachments/#crash-reports-and-privacy" />
                ),
              }
            )}
          </ListItem>
          <ListItem>
            {t(
              'Please wait one hour after upload before attempting to reprocess missing debug files.'
            )}
          </ListItem>
        </StyledList>
        <Introduction>
          {tct('For more information, please refer to [link:the documentation.]', {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/error-monitoring/reprocessing/" />
            ),
          })}
        </Introduction>

        <FieldList>
          <form.AppField name="maxEvents">
            {field => (
              <field.Layout.Row
                label={t('Number of events to be reprocessed')}
                hintText={t(
                  'If you set a limit, we will reprocess your most recent events.'
                )}
              >
                <field.Input
                  type="number"
                  placeholder={t('Reprocess all events')}
                  value={field.state.value}
                  onChange={field.handleChange}
                />
              </field.Layout.Row>
            )}
          </form.AppField>

          <form.Subscribe selector={state => state.values.maxEvents === ''}>
            {isDisabled => (
              <form.AppField name="remainingEvents">
                {field => (
                  <field.Radio.Group
                    value={field.state.value}
                    onChange={value => field.handleChange(value as 'keep' | 'delete')}
                    disabled={isDisabled}
                  >
                    <field.Layout.Row
                      label={t('Remaining events')}
                      hintText={t('What to do with the events that are not reprocessed.')}
                    >
                      <Flex gap="lg">
                        <field.Radio.Item value="keep">{t('Keep')}</field.Radio.Item>
                        <field.Radio.Item value="delete">{t('Delete')}</field.Radio.Item>
                      </Flex>
                    </field.Layout.Row>
                  </field.Radio.Group>
                )}
              </form.AppField>
            )}
          </form.Subscribe>
        </FieldList>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Reprocess Events')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

const Introduction = styled('p')`
  font-size: ${p => p.theme.font.size.lg};
`;

const StyledList = styled(List)`
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space['3xl']};
  font-size: ${p => p.theme.font.size.md};
`;

const FieldList = styled('div')`
  > *:not(:last-child) {
    padding-bottom: ${p => p.theme.space.xl};
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
    margin-bottom: ${p => p.theme.space.xl};
  }
`;
