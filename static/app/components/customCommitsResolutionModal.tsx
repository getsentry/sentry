import {queryOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';

import {t} from 'sentry/locale';
import type {ResolvedStatusDetails} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getShortCommitHash} from 'sentry/utils/git/getShortCommitHash';

import {formatCommitMessage} from './commitRow';
import {TimeSince} from './timeSince';

interface CustomCommitsResolutionModalProps extends ModalRenderProps {
  onSelected: (x: ResolvedStatusDetails) => void;
  orgSlug: string;
  projectSlug: string;
}

const DETAILS_SEPARATOR = ' \u00B7 ';

const commitSchema = z.object({
  commit: z
    .looseObject({
      id: z.string(),
      message: z.string().nullable().optional(),
      author: z.looseObject({name: z.string().nullable().optional()}).optional(),
      repository: z.looseObject({
        name: z.string(),
      }),
      dateCreated: z.string(),
    })
    .nullable()
    .refine(val => val !== null, t('Please select a commit')),
});

const defaultValues: z.input<typeof commitSchema> = {
  commit: null,
};

type Commit = z.output<typeof commitSchema>['commit'];

export function CustomCommitsResolutionModal({
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
    defaultValues,
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
    <form.AppForm form={form}>
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
                        label: formatCommitMessage(c.message ?? null),
                        details: (
                          <span>
                            {[getShortCommitHash(c.id), c.repository.name, c.author?.name]
                              .filter(Boolean)
                              .map(part => `${part}${DETAILS_SEPARATOR}`)}
                            <TimeSince date={c.dateCreated} />
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
    </form.AppForm>
  );
}
