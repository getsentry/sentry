import {useCallback, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export function CreateFromSeerPrompt() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
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
        setIsGenerating(false);
        return;
      }

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
  }, [prompt, organization.slug, location.query, navigate]);

  return (
    <Layout.Page withPadding background="secondary">
      <Flex direction="column" gap="lg" align="center" justify="center" flex="1">
        <Flex direction="column" gap="sm" width="640px">
          <Heading as="h3">{t('Describe your Dashboard')}</Heading>
          <Container paddingTop="lg">
            <Flex
              border="primary"
              radius="md"
              background="primary"
              padding="lg"
              direction="column"
              gap="lg"
              align="end"
            >
              <TextArea
                placeholder={t(
                  'Add details like what you are looking for, important data points, or anything else...'
                )}
                rows={1}
                autosize
                autoFocus
                style={{resize: 'none'}}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={isGenerating}
              />
              <Container>
                <Button
                  priority="primary"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {t('Generate')}
                </Button>
              </Container>
            </Flex>
          </Container>
        </Flex>
      </Flex>
    </Layout.Page>
  );
}
