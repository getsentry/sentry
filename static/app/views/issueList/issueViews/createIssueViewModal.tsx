import {useEffect, useRef} from 'react';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {useFormTypingAnimation} from 'sentry/views/issueList/issueViews/useFormTypingAnimation';
import {useCreateGroupSearchView} from 'sentry/views/issueList/mutations/useCreateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {useGenerateIssueViewTitle} from 'sentry/views/issueList/utils/useGenerateIssueViewTitle';

interface CreateIssueViewModalProps
  extends
    ModalRenderProps,
    Partial<
      Pick<
        GroupSearchView,
        'name' | 'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
      >
    > {
  analyticsSurface: 'issue-view-details' | 'issues-feed' | 'issue-views-list';
}

const schema = z.object({
  name: z.string().trim().min(1, t('Please enter a name for the view')),
  query: z.string(),
  querySort: z.enum(IssueSortOptions),
  projects: z.array(z.number()),
  environments: z.array(z.string()),
  timeFilters: z.object({
    start: z.string().nullable(),
    end: z.string().nullable(),
    period: z.string().nullable(),
    utc: z.boolean().nullable(),
  }),
  starred: z.boolean(),
});

export function CreateIssueViewModal({
  Header,
  Body,
  Footer,
  closeModal,
  query: incomingQuery,
  querySort: incomingQuerySort,
  projects: incomingProjects,
  environments: incomingEnvironments,
  timeFilters: incomingTimeFilters,
  name: incomingName,
  analyticsSurface,
}: CreateIssueViewModalProps) {
  const initialName = incomingName ?? '';
  const initialQuery = incomingQuery ?? 'is:unresolved';
  const organization = useOrganization();
  const navigate = useNavigate();

  const {isLoading: isGeneratingTitle, data: generatedTitleData} =
    useGenerateIssueViewTitle({
      query: initialQuery,
      enabled: !initialName.trim(),
    });
  const generatedTitle = generatedTitleData?.title;

  const {mutateAsync: createIssueView, isError} = useCreateGroupSearchView({
    onSuccess: (data, variables) => {
      navigate(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/issues/views/${data.id}/`,
          query: getIssueViewQueryParams({view: data}),
        })
      );

      trackAnalytics('issue_views.save_as.created', {
        organization,
        surface: analyticsSurface,
        starred: variables.starred ?? false,
        ai_title_shown: !!generatedTitle,
        ai_title_used: !!generatedTitle && variables.name === generatedTitle,
      });
      closeModal();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: initialName,
      query: initialQuery,
      querySort: incomingQuerySort ?? IssueSortOptions.DATE,
      projects: incomingProjects ?? [],
      environments: incomingEnvironments ?? [],
      timeFilters: incomingTimeFilters ?? {
        start: null,
        end: null,
        period: '14d',
        utc: null,
      },
      starred: true,
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => createIssueView(value).catch(() => {}),
  });

  // Applies an AI generated name with a typing animation to the name field.
  const userEditedNameRef = useRef(false);
  const {triggerFormTypingAnimation, cancelFormTypingAnimation} =
    useFormTypingAnimation();

  useEffect(() => {
    if (!generatedTitle) {
      return;
    }

    // Do not override user input if they already typed before title generation completes.
    const currentName = form.getFieldValue('name') ?? '';
    if (currentName.trim() || userEditedNameRef.current) {
      return;
    }

    triggerFormTypingAnimation({
      setValue: value => form.setFieldValue('name', value),
      text: generatedTitle,
    });
  }, [form, generatedTitle, triggerFormTypingAnimation]);

  const handleNameChange = () => {
    // Stop the synthetic animation as soon as the user edits.
    userEditedNameRef.current = true;
    cancelFormTypingAnimation();
  };

  return (
    <form.AppForm form={form}>
      <Header>
        <h4>{t('New Issue View')}</h4>
      </Header>

      <Body>
        {isError && (
          <Alert.Container>
            <Alert variant="danger" showIcon={false}>
              {t('Something went wrong. Please try again.')}
            </Alert>
          </Alert.Container>
        )}
        <Stack gap="xl">
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack label={t('Name')} required>
                <field.Input
                  value={field.state.value}
                  onChange={value => {
                    field.handleChange(value);
                    handleNameChange();
                  }}
                  placeholder={
                    isGeneratingTitle
                      ? t('Generating title...')
                      : t('e.g. My Search Results')
                  }
                  autoFocus
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <form.AppField name="starred">
            {field => (
              <field.Layout.Stack label={t('Starred')}>
                <field.Switch checked={field.state.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>

      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Create View')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
