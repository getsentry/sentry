import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import Add from './modals/add';
import Edit from './modals/edit';
import {convertRelayPiiConfig} from './convertRelayPiiConfig';
import {OrganizationRules} from './organizationRules';
import Rules from './rules';
import submitRules from './submitRules';
import {Rule} from './types';

const ADVANCED_DATASCRUBBING_LINK =
  'https://docs.sentry.io/product/data-management-settings/scrubbing/advanced-datascrubbing/';

type Props = {
  endpoint: string;
  organization: Organization;
  additionalContext?: React.ReactNode;
  disabled?: boolean;
  onSubmitSuccess?: (data: {relayPiiConfig: string}) => void;
  project?: Project;
  relayPiiConfig?: string | null;
};

export function DataScrubbing({
  project,
  endpoint,
  organization,
  disabled,
  onSubmitSuccess,
  additionalContext,
  relayPiiConfig,
}: Props) {
  const api = useApi();
  const [rules, setRules] = useState<Rule[]>([]);
  const navigate = useNavigate();
  const params = useParams();

  const successfullySaved = useCallback(
    (response: {relayPiiConfig: string}, successMessage: string) => {
      setRules(convertRelayPiiConfig(response.relayPiiConfig));
      addSuccessMessage(successMessage);
      onSubmitSuccess?.(response);
    },
    [onSubmitSuccess]
  );

  const handleCloseModal = useCallback(() => {
    const path = project?.slug
      ? `/settings/${organization.slug}/projects/${project.slug}/security-and-privacy/`
      : `/settings/${organization.slug}/security-and-privacy/`;

    navigate(path);
  }, [navigate, organization.slug, project?.slug]);

  useEffect(() => {
    if (
      !defined(params.scrubbingId) ||
      !rules.some(rule => String(rule.id) === params.scrubbingId)
    ) {
      return;
    }

    openModal(
      modalProps => (
        <Edit
          {...modalProps}
          rule={rules[params.scrubbingId]}
          projectId={project?.id}
          savedRules={rules}
          api={api}
          endpoint={endpoint}
          orgSlug={organization.slug}
          onSubmitSuccess={response => {
            return successfullySaved(
              response,
              t('Successfully updated data scrubbing rule')
            );
          }}
        />
      ),
      {onClose: handleCloseModal}
    );
  }, [
    params.scrubbingId,
    rules,
    project?.id,
    api,
    endpoint,
    organization.slug,
    successfullySaved,
    handleCloseModal,
  ]);

  useEffect(() => {
    function loadRules() {
      try {
        setRules(convertRelayPiiConfig(relayPiiConfig));
      } catch {
        addErrorMessage(t('Unable to load data scrubbing rules'));
      }
    }

    loadRules();
  }, [relayPiiConfig]);

  function handleEdit(id: Rule['id']) {
    const path = project
      ? `/settings/${organization.slug}/projects/${project.slug}/security-and-privacy/advanced-data-scrubbing/${id}/`
      : `/settings/${organization.slug}/security-and-privacy/advanced-data-scrubbing/${id}/`;

    navigate(path);
  }

  function handleAdd() {
    openModal(modalProps => (
      <Add
        {...modalProps}
        projectId={project?.id}
        savedRules={rules}
        api={api}
        endpoint={endpoint}
        orgSlug={organization.slug}
        onSubmitSuccess={response => {
          return successfullySaved(response, t('Successfully added data scrubbing rule'));
        }}
      />
    ));
  }

  async function handleDelete(id: Rule['id']) {
    try {
      const filteredRules = rules.filter(rule => rule.id !== id);
      const data = await submitRules(api, endpoint, filteredRules);
      if (data?.relayPiiConfig) {
        setRules(convertRelayPiiConfig(data.relayPiiConfig));
        addSuccessMessage(t('Successfully deleted data scrubbing rule'));
      }
    } catch {
      addErrorMessage(t('An unknown error occurred while deleting data scrubbing rule'));
    }
  }

  return (
    <Panel data-test-id="advanced-data-scrubbing">
      <PanelHeader>
        <div>{t('Advanced Data Scrubbing')}</div>
      </PanelHeader>
      <PanelAlert type="info">
        {additionalContext}{' '}
        {tct(
          'The new rules will only apply to upcoming events. For more details, see [linkToDocs].',
          {
            linkToDocs: (
              <ExternalLink href={ADVANCED_DATASCRUBBING_LINK}>
                {t('full documentation on data scrubbing')}
              </ExternalLink>
            ),
          }
        )}
      </PanelAlert>
      <PanelBody>
        {project && <OrganizationRules organization={organization} />}
        {!rules.length ? (
          <EmptyMessage
            icon={<IconWarning size="xl" />}
            description={t('You have no data scrubbing rules')}
          />
        ) : (
          <Rules
            rules={rules}
            onDeleteRule={handleDelete}
            onEditRule={handleEdit}
            disabled={disabled}
          />
        )}
        <PanelAction>
          <Button href={ADVANCED_DATASCRUBBING_LINK} external>
            {t('Read Docs')}
          </Button>
          <Button disabled={disabled} onClick={handleAdd} priority="primary">
            {t('Add Rule')}
          </Button>
        </PanelAction>
      </PanelBody>
    </Panel>
  );
}

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: grid;
  gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
  border-top: 1px solid ${p => p.theme.border};
`;
