import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {useAutofixSetup} from 'sentry/components/events/autofix/useAutofixSetup';
import Placeholder from 'sentry/components/placeholder';
import {IconFatal, IconFocus, IconSpan} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import marked from 'sentry/utils/marked';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  group: Group;
}

interface GroupSummaryData {
  groupId: string;
  headline: string;
  possibleCause?: string | null;
  trace?: string | null;
  whatsWrong?: string | null;
}

const isSummaryEnabled = (hasGenAIConsent: boolean, groupCategory: IssueCategory) => {
  return hasGenAIConsent && groupCategory === IssueCategory.ERROR;
};

export const makeGroupSummaryQueryKey = (
  organizationSlug: string,
  groupId: string
): ApiQueryKey => [
  `/organizations/${organizationSlug}/issues/${groupId}/summarize/`,
  {method: 'POST'},
];

export function useGroupSummary(groupId: string, groupCategory: IssueCategory) {
  const organization = useOrganization();
  // We piggyback and use autofix's genai consent check for now.
  const {
    data: autofixSetupData,
    isPending: isAutofixSetupLoading,
    isError: isAutofixSetupError,
  } = useAutofixSetup({groupId});

  const hasGenAIConsent = autofixSetupData?.genAIConsent.ok ?? false;

  const queryData = useApiQuery<GroupSummaryData>(
    makeGroupSummaryQueryKey(organization.slug, groupId),
    {
      staleTime: Infinity, // Cache the result indefinitely as it's unlikely to change if it's already computed
      enabled: isSummaryEnabled(hasGenAIConsent, groupCategory),
    }
  );
  return {
    ...queryData,
    isPending: isAutofixSetupLoading || queryData.isPending,
    isError: queryData.isError || isAutofixSetupError,
    hasGenAIConsent,
  };
}

export function AutofixGroupSummary({group}: Props) {
  const {data: summaryData, isPending} = useGroupSummary(group.id, group.issueCategory);

  if (isPending) {
    return (
      <LoadingContainer>
        <Placeholder height="15rem" width="95%" />
      </LoadingContainer>
    );
  }

  if (!summaryData) {
    return null;
  }

  return (
    <GroupSummaryWrapper>
      <SingleCard>
        <BadgeWrapper>
          <FeatureBadge
            type="alpha"
            title={tct(
              'Issue summary is in alpha. Try it out and let us know your feedback at [email:autofix@sentry.io].',
              {
                email: <a href="mailto:autofix@sentry.io" />,
              }
            )}
            tooltipProps={{isHoverable: true}}
          />
        </BadgeWrapper>
        <InsightGrid>
          {summaryData.whatsWrong && (
            <InsightSection>
              <SectionTitle>
                <CardTitleIcon>
                  <IconFatal size="sm" />
                </CardTitleIcon>
                {t("What's wrong")}
              </SectionTitle>
              <SectionContent
                dangerouslySetInnerHTML={{
                  __html: marked(summaryData.whatsWrong),
                }}
              />
            </InsightSection>
          )}
          {summaryData.trace && (
            <InsightSection>
              <SectionTitle>
                <CardTitleIcon>
                  <IconSpan size="sm" />
                </CardTitleIcon>
                {t('In the trace')}
              </SectionTitle>
              <SectionContent
                dangerouslySetInnerHTML={{
                  __html: marked(summaryData.trace),
                }}
              />
            </InsightSection>
          )}
          {summaryData.possibleCause && (
            <InsightSection>
              <SectionTitle>
                <CardTitleIcon>
                  <IconFocus size="sm" />
                </CardTitleIcon>
                {t('Possible cause')}
              </SectionTitle>
              <SectionContent
                dangerouslySetInnerHTML={{
                  __html: marked(summaryData.possibleCause),
                }}
              />
            </InsightSection>
          )}
        </InsightGrid>
      </SingleCard>
    </GroupSummaryWrapper>
  );
}

const GroupSummaryWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  margin-bottom: ${space(1)};
`;

const SingleCard = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const InsightGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
`;

const InsightSection = styled('div')`
  display: grid;
  grid-template-columns: 10rem 1fr;
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const SectionTitle = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(2)};
  border-right: 1px solid ${p => p.theme.border};
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const SectionContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  padding: ${space(2)};
  p {
    margin: 0;
    white-space: pre-wrap;
  }
  code {
    word-break: break-all;
  }
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(2)};
`;

const BadgeWrapper = styled('div')`
  position: absolute;
  top: -${space(1.5)};
  right: -${space(2)};
`;
