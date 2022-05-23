import {Fragment, useCallback, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {removeTeam, updateTeamSuccess} from 'sentry/actionCreators/teams';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Field from 'sentry/components/forms/field';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import teamSettingsFields from 'sentry/data/forms/teamSettingsFields';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Scope, Team} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props extends RouteComponentProps<{orgId: string; teamId: string}, {}> {
  team: Team;
}

function TeamSettings({team, params}: Props) {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();
  const [loading, setLoading] = useState(false);

  const handleSubmitSuccess: Form['props']['onSubmitSuccess'] = (resp, _model, id) => {
    // Use the old slug when triggering the update so we correctly replace the
    // previous team in the store.
    // This function is called twice - fieldSubmit, formSubmit
    // "id" is passed on fieldSubmitSuccess
    if (id === 'slug') {
      updateTeamSuccess(team.slug, resp);
      addSuccessMessage(t('Team name changed'));
      // There is no setLoading(false), the redirect is expected to reset state
      setLoading(true);
      browserHistory.replace(`/settings/${params.orgId}/teams/${resp.slug}/settings/`);
    }
  };

  const handleRemoveTeam = useCallback(async () => {
    await removeTeam(api, params);
    browserHistory.replace(`/settings/${params.orgId}/teams/`);
  }, [api, params]);

  const access = new Set<Scope>(organization.access);

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title="Team Settings" />

      <Form
        apiMethod="PUT"
        apiEndpoint={`/teams/${params.orgId}/${team.slug}/`}
        saveOnBlur
        allowUndo
        onSubmitSuccess={handleSubmitSuccess}
        onSubmitError={() => addErrorMessage(t('Unable to save change'))}
        initialData={{
          name: team.name,
          slug: team.slug,
        }}
      >
        <JsonForm access={access} forms={teamSettingsFields} />
      </Form>

      <Panel>
        <PanelHeader>{t('Remove Team')}</PanelHeader>
        <Field
          help={t(
            "This may affect team members' access to projects and associated alert delivery."
          )}
        >
          <div>
            <Confirm
              disabled={!access.has('team:admin')}
              onConfirm={handleRemoveTeam}
              priority="danger"
              message={tct('Are you sure you want to remove the team [team]?', {
                team: `#${team.slug}`,
              })}
            >
              <Button
                icon={<IconDelete />}
                priority="danger"
                disabled={!access.has('team:admin')}
              >
                {t('Remove Team')}
              </Button>
            </Confirm>
          </div>
        </Field>
      </Panel>
    </Fragment>
  );
}
export default TeamSettings;
