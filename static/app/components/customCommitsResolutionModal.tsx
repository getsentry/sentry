import {queryOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import type {ResolvedStatusDetails} from 'sentry/types/group';
import type {Commit} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface CustomCommitsResolutionModalProps extends ModalRenderProps {
  onSelected: (x: ResolvedStatusDetails) => void;
  orgSlug: string;
  projectSlug: string;
}

// We use z.any() because the Commit type is complex and Zod's passthrough() adds index
// signatures that don't match. The refine() ensures a commit is selected (non-null).
const commitSchema = z.object({
  commit: z
    .any()
    .refine((val): val is Commit => val !== null, t('Please select a commit')),
});

function CustomCommitsResolutionModal({
  onSelected,
  orgSlug,
  projectSlug,
  closeModal,
  Header,
  Body,
  Footer,
}: CustomCommitsResolutionModalProps) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      commit: null as Commit | null,
    },
    validators: {
      onDynamic: commitSchema,
    },
    onSubmit: ({value}) => {
      onSelected({
        inCommit: {
          commit: value.commit?.id,
          repository: value.commit?.repository?.name,
        },
      });
      closeModal();
    },
  });

  return (
    <form.AppForm>
      <form.FormWrapper>
        <Header>
          <h4>{t('Resolved In')}</h4>
        </Header>
        <Body>
          <form.AppField name="commit">
            {field => (
              <field.Layout.Stack label={t('Commit')} required>
                <field.SelectAsync
                  value={field.state.value}
                  onChange={field.handleChange}
                  queryOptions={debouncedInput => {
                    return queryOptions({
                      ...apiOptions.as<Commit[]>()(
                        '/projects/$organizationIdOrSlug/$projectIdOrSlug/commits/',
                        {
                          path: {
                            organizationIdOrSlug: orgSlug,
                            projectIdOrSlug: projectSlug,
                          },
                          query: {query: debouncedInput},
                          staleTime: 30_000,
                        }
                      ),
                      select: ({json: commits}) =>
                        commits.map(c => ({
                          value: c,
                          textValue: c.id,
                          label: <Version version={c.id} anchor={false} />,
                          details: (
                            <span>
                              {t('Created')} <TimeSince date={c.dateCreated} />
                            </span>
                          ),
                        })),
                    });
                  }}
                  placeholder={t('e.g. d86b832')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Body>
        <Footer>
          <Flex gap="sm" justify="end">
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <form.SubmitButton>{t('Resolve')}</form.SubmitButton>
          </Flex>
        </Footer>
      </form.FormWrapper>
    </form.AppForm>
  );
}

export default CustomCommitsResolutionModal;
