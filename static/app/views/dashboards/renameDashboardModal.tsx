import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DashboardRenameSurface} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRenameDashboard} from 'sentry/views/dashboards/hooks/useRenameDashboard';

/**
 * Structural on purpose, so the same modal serves the detail page
 * (`DashboardDetails`) and the manage table (`DashboardListItem`).
 */
export interface RenameableDashboard {
  id: string;
  title: string;
}

// Matches the `title` column on the backend serializer.
const MAX_TITLE_LENGTH = 255;

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, t('Please set a title for this dashboard'))
    .max(MAX_TITLE_LENGTH),
});

interface RenameDashboardModalProps extends ModalRenderProps {
  dashboard: RenameableDashboard;
  onRename: (newTitle: string) => void;
  surface: DashboardRenameSurface;
}

export function useOpenRenameDashboardModal(
  dashboard: RenameableDashboard,
  onRename: (newTitle: string) => void,
  surface: DashboardRenameSurface
) {
  const {openModal} = useModal();
  const organization = useOrganization();

  return () => {
    trackAnalytics('dashboards2.rename.start', {organization, surface});
    openModal(
      props => (
        <RenameDashboardModal
          {...props}
          dashboard={dashboard}
          onRename={onRename}
          surface={surface}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };
}

/**
 * Renames a dashboard, independently of any edit session it might be part of.
 */
function RenameDashboardModal({
  Header,
  Body,
  Footer,
  closeModal,
  dashboard,
  onRename,
  surface,
}: RenameDashboardModalProps) {
  const organization = useOrganization();
  const {mutateAsync: renameDashboard} = useRenameDashboard();

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {title: dashboard.title},
    validators: {onDynamic: schema},
    onSubmit: async ({value}) => {
      const title = value.title.trim();

      // A dashboard that has never been saved has no id to PUT against. Its
      // title rides along on the create request instead, so the rename only
      // has to reach the caller's local state.
      if (dashboard.id) {
        try {
          await renameDashboard({dashboardId: dashboard.id, title});
        } catch {
          // `updateDashboardTitle` has already surfaced the reason — a name
          // collision, most often. Leave the modal open so it can be corrected.
          return;
        }
        addSuccessMessage(t('Dashboard renamed'));
      }

      trackAnalytics('dashboards2.rename.save', {organization, surface});
      onRename(title);
      closeModal();
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h3" size="xl">
          {t('Rename Dashboard')}
        </Heading>
      </Header>

      <Body>
        <form.AppField name="title">
          {field => (
            <field.Layout.Stack label={t('Name')} required>
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                maxLength={MAX_TITLE_LENGTH}
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
