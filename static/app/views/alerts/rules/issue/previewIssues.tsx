import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import FieldHelp from 'sentry/components/forms/fieldGroup/fieldHelp';
import ExternalLink from 'sentry/components/links/externalLink';
import ListItem from 'sentry/components/list/listItem';
import type {CursorHandler} from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule, UnsavedIssueAlertRule} from 'sentry/types/alerts';
import type {Member} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import {useIsMountedRef} from 'sentry/utils/useIsMountedRef';
import useOrganization from 'sentry/utils/useOrganization';

import PreviewTable from './previewTable';

const SENTRY_ISSUE_ALERT_DOCS_URL =
  'https://docs.sentry.io/product/alerts/alert-types/#issue-alerts';

function PreviewText({issueCount, previewError}: any) {
  if (previewError) {
    return (
      <Fragment>
        {t("Select a condition above to see which issues would've triggered this alert")}
      </Fragment>
    );
  }

  return tct(
    "[issueCount] issues would have triggered this rule in the past 14 days [approximately:approximately]. If you're looking to reduce noise then make sure to [link:read the docs].",
    {
      issueCount,
      approximately: (
        <Tooltip
          title={t('Previews that include issue frequency conditions are approximated')}
          showUnderline
        />
      ),
      link: <ExternalLink href={SENTRY_ISSUE_ALERT_DOCS_URL} />,
    }
  );
}

interface PreviewIssuesProps {
  members: Member[] | undefined;
  project: Project;
  rule?: UnsavedIssueAlertRule | IssueAlertRule | null;
}

export function PreviewIssues({members, rule, project}: PreviewIssuesProps) {
  const api = useApi();
  const organization = useOrganization();
  const isMounted = useIsMountedRef();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<boolean>(false);
  const [previewGroups, setPreviewGroups] = useState<string[]>([]);
  const [previewPage, setPreviewPage] = useState<number>(0);
  const [pageLinks, setPageLinks] = useState<string>('');
  const [issueCount, setIssueCount] = useState<number>(0);
  const endDateRef = useRef<string | null>(null);

  /**
   * If any of this data changes we'll need to re-fetch the preview
   */
  const relevantRuleData = useMemo(
    () =>
      rule
        ? {
            conditions: rule.conditions || [],
            filters: rule.filters || [],
            actionMatch: rule.actionMatch || 'all',
            filterMatch: rule.filterMatch || 'all',
            frequency: rule.frequency || 60,
          }
        : {},
    [rule]
  );

  /**
   * Not using useApiQuery because it makes a post request
   */
  const fetchApiData = useCallback(
    (ruleFields: any, cursor?: string | null, resetCursor?: boolean) => {
      setIsLoading(true);
      if (resetCursor) {
        setPreviewPage(0);
      }

      // we currently don't have a way to parse objects from query params, so this method is POST for now
      api
        .requestPromise(`/projects/${organization.slug}/${project.slug}/rules/preview/`, {
          method: 'POST',
          includeAllArgs: true,
          query: {
            cursor,
            per_page: 5,
          },
          data: {
            ...ruleFields,
            // so the end date doesn't change? Not sure.
            endpoint: endDateRef.current,
          },
        })
        .then(([data, _, resp]) => {
          if (!isMounted.current) {
            return;
          }

          GroupStore.add(data);

          const hits = resp?.getResponseHeader('X-Hits');
          const count = typeof hits !== 'undefined' && hits ? parseInt(hits, 10) : 0;
          setPreviewGroups(data.map((g: any) => g.id));
          setPreviewError(false);
          setPageLinks(resp?.getResponseHeader('Link') ?? '');
          setIssueCount(count);
          setIsLoading(false);
          endDateRef.current = resp?.getResponseHeader('Endpoint') ?? null;
        })
        .catch(_ => {
          setPreviewError(true);
          setIsLoading(false);
        });
    },
    [
      setIsLoading,
      setPreviewError,
      setPreviewGroups,
      setIssueCount,
      api,
      project.slug,
      organization.slug,
      isMounted,
    ]
  );

  const debouncedFetchApiData = useMemo(
    () => debounce(fetchApiData, 500),
    [fetchApiData]
  );

  useEffect(() => {
    debouncedFetchApiData(relevantRuleData, null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(relevantRuleData), debouncedFetchApiData]);

  useEffect(() => {
    return () => {
      debouncedFetchApiData.cancel();
      // Reset the group store when leaving
      GroupStore.reset();
    };
  }, [debouncedFetchApiData]);

  const onPreviewCursor: CursorHandler = (cursor, _1, _2, direction) => {
    setPreviewPage(previewPage + direction);
    debouncedFetchApiData.cancel();
    fetchApiData(relevantRuleData, cursor);
  };

  const errorMessage = previewError
    ? rule?.conditions.length || rule?.filters.length
      ? t('Preview is not supported for these conditions')
      : t('Select a condition to generate a preview')
    : null;

  return (
    <Fragment>
      <StyledListItem>
        <StepHeader>{t('Preview')}</StepHeader>
        <StyledFieldHelp>
          <PreviewText issueCount={issueCount} previewError={previewError} />
        </StyledFieldHelp>
      </StyledListItem>
      <ContentIndent>
        <PreviewTable
          previewGroups={previewGroups}
          members={members}
          pageLinks={pageLinks}
          onCursor={onPreviewCursor}
          issueCount={issueCount}
          page={previewPage}
          isLoading={isLoading}
          error={errorMessage}
        />
      </ContentIndent>
    </Fragment>
  );
}

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const StepHeader = styled('h5')`
  margin-bottom: ${space(1)};
`;

const StyledFieldHelp = styled(FieldHelp)`
  margin-top: 0;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-left: -${space(4)};
  }
`;

const ContentIndent = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    margin-left: ${space(4)};
  }
`;
