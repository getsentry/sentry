import {useEffect, useState} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {getIssueViewQueryParams} from 'sentry/views/issueList/issueViews/getIssueViewQueryParams';
import {useCreateGroupSearchView} from 'sentry/views/issueList/mutations/useCreateGroupSearchView';
import {useGenerateIssueViewTitle} from 'sentry/views/issueList/queries/useGenerateIssueViewTitle';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

interface CreateIssueViewModalProps
  extends ModalRenderProps,
    Partial<
      Pick<
        GroupSearchView,
        'name' | 'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
      >
    > {
  analyticsSurface: 'issue-view-details' | 'issues-feed' | 'issue-views-list';
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
  const organization = useOrganization();
  const navigate = useNavigate();
  const hasAiTitleFeature = organization.features.includes('issue-view-ai-title');

  const [generatedName, setGeneratedName] = useState<string | undefined>(undefined);

  const {mutate: generateTitle, isPending: isGeneratingTitle} = useGenerateIssueViewTitle(
    {
      onSuccess: data => {
        setGeneratedName(data.title);
      },
    }
  );

  useEffect(() => {
    if (hasAiTitleFeature && incomingQuery) {
      generateTitle({query: incomingQuery});
    }
  }, [hasAiTitleFeature, incomingQuery, generateTitle]);

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
    name: generatedName ?? incomingName ?? '',
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
      key={generatedName}
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
