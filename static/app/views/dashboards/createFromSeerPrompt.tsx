import {useState} from 'react';
import {parseAsInteger, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {TextArea} from '@sentry/scraps/textarea';
import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function CreateFromSeerPrompt() {
  const organization = useOrganization();
  const [, setSeerRunId] = useQueryState(
    'seerRunId',
    parseAsInteger.withOptions({history: 'push'})
  );
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
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
        toast.error(t('Failed to start dashboard generation'));
        setIsGenerating(false);
        return;
      }

      setSeerRunId(Number(runId));
    } catch (error) {
      setIsGenerating(false);
      toast.error(t('Failed to start dashboard generation'));
    }
  };

  return (
    <Stack flex={1} padding="2xl 3xl">
      <Stack gap="lg" align="center" justify="center" flex="1">
        <Stack gap="sm" width="640px">
          <Heading as="h3">{t('Describe your Dashboard')}</Heading>
          <Container paddingTop="lg">
            <Stack
              border="primary"
              radius="md"
              background="primary"
              padding="lg"
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
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                >
                  {t('Generate')}
                </Button>
              </Container>
            </Stack>
          </Container>
        </Stack>
      </Stack>
    </Stack>
  );
}
