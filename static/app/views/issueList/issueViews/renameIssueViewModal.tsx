import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';

interface RenameIssueViewModalProps extends ModalRenderProps {
  analyticsSurface: 'issue-view-details' | 'issue-views-list';
  onRename: (view: GroupSearchView) => void;
  view: GroupSearchView;
}

export function RenameIssueViewModal({
  Header,
  Body,
  closeModal,
  view,
  analyticsSurface,
  onRename,
}: RenameIssueViewModalProps) {
  const organization = useOrganization();
  const user = useUser();

  const {
    mutate: updateIssueView,
    isPending,
    isError,
  } = useUpdateGroupSearchView({
    onSuccess: data => {
      closeModal();
      trackAnalytics('issue_views.edit_name', {
        organization,
        surface: analyticsSurface,
        ownership: view.createdBy?.id === user.id ? 'personal' : 'organization',
      });
      onRename(data);
    },
  });

  const handleSubmit: OnSubmitCallback = data => {
    updateIssueView({
      ...view,
      name: data.name,
    });
  };

  const initialData = {
    name: view.name,
  };

  return (
    <Form
      onSubmit={handleSubmit}
      onCancel={closeModal}
      saveOnBlur={false}
      submitLabel={t('Save Changes')}
      submitDisabled={isPending}
      initialData={initialData}
    >
      <Header>
        <h4>{t('Rename Issue View')}</h4>
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
          placeholder="e.g. My Search Results"
          inline={false}
          stacked
          flexibleControlStateSize
          required
          autoFocus
        />
      </Body>
    </Form>
  );
}
