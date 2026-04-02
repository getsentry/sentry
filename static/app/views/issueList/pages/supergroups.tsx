import styled from '@emotion/styled';

import {FeatureBadge} from '@sentry/scraps/badge';
import {inlineCodeStyles} from '@sentry/scraps/code';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {useDrawer} from 'sentry/components/globalDrawer';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import {IconFocus} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface ListSupergroupsResponse {
  data: SupergroupDetail[];
}

function SupergroupCard({
  supergroup,
  onClick,
}: {
  onClick: () => void;
  supergroup: SupergroupDetail;
}) {
  return (
    <CardContainer background="primary" border="primary" radius="md" onClick={onClick}>
      <Stack padding="lg" gap="md">
        <Text size="lg" bold wordBreak="break-word">
          {supergroup.title}
        </Text>

        <Stack gap="xs">
          <Text size="xs" variant="muted">
            {tn('%s issue', '%s issues', supergroup.group_ids.length)}
          </Text>
          {supergroup.error_type && (
            <Flex align="baseline" gap="xs">
              <Text size="xs" variant="muted" bold>
                {t('Error:')}
              </Text>
              <Text size="xs" variant="muted">
                {supergroup.error_type}
              </Text>
            </Flex>
          )}
          {supergroup.code_area && (
            <Flex align="baseline" gap="xs">
              <Text size="xs" variant="muted" bold>
                {t('Location:')}
              </Text>
              <Text size="xs" variant="muted">
                {supergroup.code_area}
              </Text>
            </Flex>
          )}
        </Stack>

        {supergroup.summary && (
          <Container background="secondary" border="primary" radius="md">
            <Flex direction="column" padding="md lg" gap="sm">
              <Flex align="center" gap="xs">
                <IconFocus size="xs" variant="promotion" />
                <Text size="sm" bold>
                  {t('Root Cause')}
                </Text>
              </Flex>
              <Text size="sm">
                <StyledMarkedText text={supergroup.summary} inline as="span" />
              </Text>
            </Flex>
          </Container>
        )}
      </Stack>
    </CardContainer>
  );
}

function Supergroups() {
  const organization = useOrganization();
  const hasTopIssuesUI = organization.features.includes('top-issues-ui');
  const {openDrawer} = useDrawer();

  const {
    data: response,
    isPending,
    isError,
    refetch,
  } = useApiQuery<ListSupergroupsResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/seer/supergroups/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {
      staleTime: 60000,
      enabled: hasTopIssuesUI,
    }
  );

  const supergroups = (response?.data ?? []).filter(sg => sg.group_ids.length > 1);

  const handleSupergroupClick = (supergroup: SupergroupDetail) => {
    openDrawer(
      () => <SupergroupDetailDrawer supergroup={supergroup} matchedGroupIds={[]} />,
      {
        ariaLabel: t('Supergroup details'),
        drawerKey: 'supergroup-drawer',
      }
    );
  };

  if (!hasTopIssuesUI) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <Stack flex={1}>
      <Layout.Header noActionWrap unified>
        <Layout.HeaderContent>
          <Flex align="center" gap="md">
            <Heading as="h1">{t('Supergroups')}</Heading>
            <FeatureBadge type="experimental" />
          </Flex>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <FeedbackButton
            size="sm"
            feedbackOptions={{
              messagePlaceholder: t('What do you think about Supergroups?'),
              tags: {
                ['feedback.source']: 'supergroups',
                ['feedback.owner']: 'issues',
              },
            }}
          />
        </Layout.HeaderActions>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main width="full">
          {isPending ? (
            <LoadingIndicator />
          ) : isError ? (
            <LoadingError onRetry={refetch} />
          ) : supergroups.length === 0 ? (
            <Container padding="lg" border="primary" radius="md" background="primary">
              <Text variant="muted" align="center" as="div">
                {t('No supergroups found')}
              </Text>
            </Container>
          ) : (
            <Stack gap="lg">
              <Text size="sm" variant="muted">
                {tn('%s supergroup', '%s supergroups', supergroups.length)}
              </Text>
              <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="lg">
                {supergroups.map(sg => (
                  <SupergroupCard
                    key={sg.id}
                    supergroup={sg}
                    onClick={() => handleSupergroupClick(sg)}
                  />
                ))}
              </Grid>
            </Stack>
          )}
        </Layout.Main>
      </Layout.Body>
    </Stack>
  );
}

const CardContainer = styled(Container)`
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
    border-color: ${p => p.theme.tokens.border.accent.moderate};
    box-shadow: ${p => p.theme.dropShadowMedium};
  }
`;

export const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;

export default Supergroups;
