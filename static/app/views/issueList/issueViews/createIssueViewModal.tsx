import {useCallback, useEffect, useRef, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {useFormTypingAnimation} from 'sentry/components/events/autofix/useFormTypingAnimation';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
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

/**
 * Applies a generated name after loading
 */
function useGeneratedIssueViewName(formModel: FormModel) {
  const {isLoading: isGeneratingTitle, data} = useGenerateIssueViewTitle({
    query: formModel.getValue<string>('query'),
  });
  const userEditedNameRef = useRef(false);
  const {triggerFormTypingAnimation, cancelFormTypingAnimation} = useFormTypingAnimation({
    speed: 70,
    quiet: true,
  });

  useEffect(() => {
    if (!formModel || !data?.title) {
      return;
    }

    // Do not override user input if they already typed before title generation completes.
    const currentName = formModel.getValue<string>('name') ?? '';
    if (currentName.trim() || userEditedNameRef.current) {
      return;
    }

    triggerFormTypingAnimation({
      formModel,
      fieldName: 'name',
      text: data.title,
    });
  }, [formModel, data?.title, triggerFormTypingAnimation]);

  const handleNameChange = useCallback(() => {
    // Stop the synthetic animation as soon as the user edits.
    userEditedNameRef.current = true;
    cancelFormTypingAnimation();
  }, [cancelFormTypingAnimation]);

  return {isGeneratingTitle, handleNameChange};
}

export function CreateIssueViewModal({
  Header,
  Body,
  closeModal,
  query: incomingQuery,
  querySort: incomingQuerySort,
  projects: incomingProjects,
  environments: incomingEnvironments,
  timeFilters: incomingTimeFilters,
  name: incomingName,
  analyticsSurface,
}: CreateIssueViewModalProps) {
  const [formModel] = useState(() => new FormModel());
  const organization = useOrganization();
  const navigate = useNavigate();
  const {isGeneratingTitle, handleNameChange} = useGeneratedIssueViewName(formModel);

  const {
    mutate: createIssueView,
    isPending,
    isError,
  } = useCreateGroupSearchView({
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
      });
      closeModal();
    },
  });

  const handleSubmit: OnSubmitCallback = data => {
    createIssueView({
      name: data.name,
      starred: data.starred,
      query: data.query,
      querySort: data.querySort,
      projects: data.projects,
      environments: data.environments,
      timeFilters: data.timeFilters,
    });
  };

  const initialData = {
    name: incomingName ?? '',
    query: incomingQuery ?? 'is:unresolved',
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
  };

  return (
    <Form
      model={formModel}
      onSubmit={handleSubmit}
      onCancel={closeModal}
      saveOnBlur={false}
      submitLabel={t('Create View')}
      submitDisabled={isPending}
      initialData={initialData}
    >
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
        <TextField
          key="name"
          name="name"
          label={t('Name')}
          placeholder={
            isGeneratingTitle ? t('Generating title...') : 'e.g. My Search Results'
          }
          inline={false}
          stacked
          flexibleControlStateSize
          required
          autoFocus
          onChange={handleNameChange}
        />
        <BooleanField
          key="starred"
          name="starred"
          label={t('Starred')}
          inline={false}
          stacked
        />
      </Body>
    </Form>
  );
}
