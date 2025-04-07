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
import {useCreateGroupSearchView} from 'sentry/views/issueList/mutations/useCreateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';

interface CreateIssueViewModalProps
  extends ModalRenderProps,
    Pick<
      GroupSearchView,
      'query' | 'querySort' | 'projects' | 'environments' | 'timeFilters'
    > {}

export function CreateIssueViewModal({
  Header,
  Body,
  closeModal,
  query,
  querySort,
  projects,
  environments,
  timeFilters,
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
      query,
      querySort,
      projects,
      environments,
      timeFilters,
    });
  };

  return (
    <Form
      onSubmit={handleSubmit}
      onCancel={closeModal}
      saveOnBlur={false}
      submitLabel={t('Create View')}
      submitDisabled={isPending}
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
