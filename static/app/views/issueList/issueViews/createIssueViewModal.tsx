import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useCreateGroupSearchView} from 'sentry/views/issueList/mutations/useCreateGroupSearchView';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {getSortLabel, IssueSortOptions} from 'sentry/views/issueList/utils';

interface CreateIssueViewModalProps
  extends ModalRenderProps,
    Partial<
      Pick<
        GroupSearchView,
        'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
      >
    > {}

const sortOptions = [
  IssueSortOptions.DATE,
  IssueSortOptions.NEW,
  IssueSortOptions.TRENDS,
  IssueSortOptions.FREQ,
  IssueSortOptions.USER,
];

const selectFieldSortOptions = sortOptions.map(sortOption => ({
  value: sortOption,
  label: getSortLabel(sortOption),
}));

export function CreateIssueViewModal({
  Header,
  Body,
  closeModal,
  query: incomingQuery,
  querySort: incomingQuerySort,
  projects: incomingProjects,
  environments: incomingEnvironments,
  timeFilters: incomingTimeFilters,
}: CreateIssueViewModalProps) {
  const organization = useOrganization();
  const navigate = useNavigate();

  const {
    mutate: createIssueView,
    isPending,
    isError,
  } = useCreateGroupSearchView({
    onSuccess: (data, variables) => {
      navigate(
        normalizeUrl(`/organizations/${organization.slug}/issues/views/${data.id}/`)
      );

      trackAnalytics('issue_views.created', {
        organization,
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
    name: '',
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
    starred: false,
  };

  return (
    <Form
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
            <Alert type="error">{t('Something went wrong. Please try again.')}</Alert>
          </Alert.Container>
        )}
        <TextField
          key="name"
          name="name"
          label={t('Name')}
          placeholder="e.g. My Search Results"
          inline={false}
          stacked
          flexibleControlStateSize
          required
          autoFocus
        />
        <PageFiltersContainer disablePersistence skipLoadLastUsed>
          {!defined(incomingProjects) && (
            <FormField
              key="projects"
              name="projects"
              label={t('Projects')}
              inline={false}
              stacked
              flexibleControlStateSize
            >
              {({onChange, onBlur, disabled}) => (
                <ProjectPageFilter
                  disabled={disabled}
                  onChange={newValue => {
                    onChange(newValue, {});
                    onBlur(newValue, {});
                  }}
                />
              )}
            </FormField>
          )}
          {!defined(incomingEnvironments) && (
            <FormField
              key="environments"
              name="environments"
              label={t('Environments')}
              inline={false}
              stacked
              flexibleControlStateSize
            >
              {({onChange, onBlur, disabled}) => (
                <EnvironmentPageFilter
                  disabled={disabled}
                  onChange={newValue => {
                    onChange(newValue, {});
                    onBlur(newValue, {});
                  }}
                />
              )}
            </FormField>
          )}

          {!defined(incomingTimeFilters) && (
            <FormField
              key="timeFilters"
              name="timeFilters"
              label={t('Time Range')}
              inline={false}
              stacked
              flexibleControlStateSize
            >
              {({onChange, onBlur, disabled}) => (
                <DatePageFilter
                  disabled={disabled}
                  onChange={newValue => {
                    const convertedValue = {
                      period: newValue.relative ?? null,
                      start: newValue.start ? getUtcDateString(newValue.start) : null,
                      end: newValue.end ? getUtcDateString(newValue.end) : null,
                      utc: newValue.utc ?? null,
                    };
                    onChange(convertedValue, {});
                    onBlur(convertedValue, {});
                  }}
                />
              )}
            </FormField>
          )}
        </PageFiltersContainer>
        {!defined(incomingQuery) && (
          <FormField
            key="query"
            name="query"
            label={t('Query')}
            inline={false}
            stacked
            flexibleControlStateSize
          >
            {({onChange, onBlur, disabled, value}) => (
              <IssueListSearchBar
                organization={organization}
                onChange={newValue => {
                  onChange(newValue, {});
                  onBlur(newValue, {});
                }}
                disabled={disabled}
                initialQuery={value}
                searchSource="saved_searches_modal"
              />
            )}
          </FormField>
        )}
        {!defined(incomingQuerySort) && (
          <SelectField
            key="querySort"
            name="querySort"
            options={selectFieldSortOptions}
            label={t('Sort')}
            inline={false}
            stacked
            flexibleControlStateSize
          />
        )}
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
