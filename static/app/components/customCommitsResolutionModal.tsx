import {useMemo, useState} from 'react';
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
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

interface CustomCommitsResolutionModalProps extends ModalRenderProps {
  onSelected: (x: ResolvedStatusDetails) => void;
  orgSlug: string;
  projectSlug: string;
}

function CustomCommitsResolutionModal({
  onSelected,
  orgSlug,
  projectSlug,
  closeModal,
  Header,
  Body,
  Footer,
}: CustomCommitsResolutionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);

  const {data: commits = [], isPending} = useApiQuery<Commit[]>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/commits/', {
        path: {
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug,
        },
      }),
      {
        query: {
          query: debouncedSearch,
        },
      },
    ],
    {
      staleTime: 30_000,
    }
  );

  const options = useMemo(
    () =>
      commits.map(c => ({
        value: c.id,
        label: <Version version={c.id} anchor={false} />,
        details: (
          <span>
            {t('Created')} <TimeSince date={c.dateCreated} />
          </span>
        ),
      })),
    [commits]
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      commit: '',
    },
    validators: {
      onDynamic: z.object({
        commit: z.string().min(1, t('Please select a commit')),
      }),
    },
    onSubmit: ({value}) => {
      const selectedCommit = commits.find(c => c.id === value.commit);
      onSelected({
        inCommit: {
          commit: selectedCommit?.id,
          repository: selectedCommit?.repository?.name,
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
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  options={options}
                  onInputChange={setSearchQuery}
                  isLoading={isPending}
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
