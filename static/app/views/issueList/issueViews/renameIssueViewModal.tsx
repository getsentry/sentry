import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';

interface RenameIssueViewModalProps extends ModalRenderProps {
  analyticsSurface: 'issue-view-details' | 'issue-views-list';
  onRename: (view: GroupSearchView) => void;
  view: GroupSearchView;
}

const schema = z.object({
  name: z.string().min(1, t('Name is required')),
});

export function RenameIssueViewModal({
  Header,
  Body,
  Footer,
  closeModal,
  view,
  analyticsSurface,
  onRename,
}: RenameIssueViewModalProps) {
  const organization = useOrganization();
  const user = useUser();

  const {mutateAsync: updateIssueView, isError} = useUpdateGroupSearchView({
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

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {name: view.name},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => updateIssueView({...view, name: value.name}).catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
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
        <form.AppField name="name">
          {field => (
            <field.Layout.Stack label={t('Name')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. My Search Results"
                autoFocus
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
      </Body>

      <Footer>
        <Flex gap="sm" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
