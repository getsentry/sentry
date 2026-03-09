import {Fragment, useCallback, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from '@sentry/scraps/button';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
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
  api,
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
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/dashboards/generate/`,
        {
          method: 'POST',
          data: {prompt: prompt.trim()},
        }
      );

      const runId = response.run_id;
      if (!runId) {
        throw new Error('No run_id in response');
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
  }, [prompt, api, organization.slug, location.query, closeModal, navigate]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Generate Dashboard with AI')}</h4>
      </Header>
      <Body>
        <Description>
          {t(
            'Describe the dashboard you want to create and Seer will generate it for you.'
          )}
        </Description>
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
        <FooterActions>
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
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

export default GenerateDashboardFromSeerModal;

export const modalCss = css`
  max-width: 600px;
  margin: 70px auto;
`;

const Description = styled('p')`
  margin-bottom: ${space(2)};
`;

const FooterActions = styled('div')`
  display: flex;
  gap: ${space(1)};
  justify-content: flex-end;
  width: 100%;
`;
