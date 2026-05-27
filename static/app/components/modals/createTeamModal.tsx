import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t, tct} from 'sentry/locale';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Organization, Team} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {slugify} from 'sentry/utils/slugify';

interface Props extends ModalRenderProps {
  organization: Organization;
  onClose?: (team: Team) => void;
}

const schema = z.object({
  slug: z.string().min(1, t('Slug is required')),
});

function CreateTeamModal({Body, Header, organization, onClose, closeModal}: Props) {
  const {mutateAsync: submitCreateTeam} = useMutation({
    mutationFn: (data: {slug: string}) =>
      fetchMutation<Team>({
        method: 'POST',
        url: getApiUrl('/organizations/$organizationIdOrSlug/teams/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        data,
      }),
    onSuccess: team => {
      TeamStore.onCreateSuccess(team);
      addSuccessMessage(
        tct('[team] has been added to the [organization] organization', {
          team: `#${team.slug}`,
          organization: organization.slug,
        })
      );
      closeModal();
      onClose?.(team);
    },
    onError: (_err, variables) => {
      addErrorMessage(
        tct('Unable to create [team] in the [organization] organization', {
          team: `#${variables.slug}`,
          organization: organization.slug,
        })
      );
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {slug: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => submitCreateTeam(value).catch(() => {}),
  });

  return (
    <Fragment>
      <Header closeButton>
        <h5>{t('Create Team')}</h5>
      </Header>
      <Body>
        <Text as="p">
          {t('Teams group members for issue assignment, ownership, and notifications.')}
        </Text>
        <form.AppForm form={form}>
          <form.AppField name="slug">
            {field => (
              <field.Layout.Stack
                label={t('Team Slug')}
                hintText={t('Use lowercase letters, numbers, dashes, and underscores.')}
                required
              >
                <field.Input
                  value={field.state.value}
                  onChange={value => field.handleChange(slugify(value))}
                  placeholder={t('e.g. operations, web-frontend, mobile-ios')}
                  autoFocus
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
          <Flex justify="end" padding="md 0 0 0">
            <form.SubmitButton>{t('Create Team')}</form.SubmitButton>
          </Flex>
        </form.AppForm>
      </Body>
    </Fragment>
  );
}

export default CreateTeamModal;
