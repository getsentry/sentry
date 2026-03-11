import {Fragment, useCallback, useState} from 'react';
import type {Location} from 'history';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

export interface GenerateDashboardFromSeerModalProps {
  api: Client;
  location: Location;
  navigate: ReactRouter3Navigate;
  organization: Organization;
}

function GenerateDashboardFromSeerModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  location,
  navigate,
}: ModalRenderProps & GenerateDashboardFromSeerModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsGenerating(true);

    try {
      const url = getApiUrl('/organizations/$organizationIdOrSlug/dashboards/generate/', {
        path: {
          organizationIdOrSlug: organization.slug,
        },
      });
      const response = await fetchMutation<{run_id: string}>({
        url,
        method: 'POST',
        data: {prompt: prompt.trim()},
      });

      const runId = response.run_id;
      if (!runId) {
        addErrorMessage(t('Failed to start dashboard generation'));
      }

      closeModal();

      navigate(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboards/new/from-seer/`,
          query: {...location.query, seerRunId: String(runId)},
        })
      );
    } catch (error) {
      setIsGenerating(false);
      addErrorMessage(t('Failed to start dashboard generation'));
    }
  }, [prompt, organization.slug, location.query, closeModal, navigate]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Generate Dashboard with Seer')}</h4>
      </Header>
      <Body>
        <p>{t('Describe the dashboard you would like Seer to generate for you.')}</p>
        <TextArea
          value={prompt}
          onChange={(e: {target: HTMLTextAreaElement}) => setPrompt(e.target.value)}
          placeholder={t(
            'e.g. Show me error rates by project with a breakdown of error types'
          )}
          rows={4}
          autoFocus
          disabled={isGenerating}
        />
      </Body>
      <Footer>
        <Flex justify="end">
          <Button onClick={closeModal} disabled={isGenerating}>
            {t('Cancel')}
          </Button>
          <Button
            priority="primary"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            icon={<IconSeer />}
          >
            {isGenerating ? t('Generating...') : t('Generate')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

export default GenerateDashboardFromSeerModal;
