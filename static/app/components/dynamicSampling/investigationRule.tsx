import styled from '@emotion/styled';
import moment from 'moment';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {BaseButtonProps, Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion, IconStack} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  ApiQueryKey,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

// Number of samples under which we can trigger an investigation rule
const INVESTIGATION_MAX_SAMPLES_TRIGGER = 5;

type Props = {
  buttonProps: BaseButtonProps;
  eventView: EventView;
  numSamples: number | null | undefined;
  organization: OrganizationSummary;
};

type CustomDynamicSamplingRule = {
  condition: Record<string, any>;
  dateAdded: string;
  endDate: string;
  numSamples: number;
  orgId: string;
  projects: number[];
  ruleId: number;
  sampleRate: number;
  startDate: string;
};
type CreateCustomRuleVariables = {
  organization: OrganizationSummary;
  period: string | null;
  projects: number[];
  query: string;
};

function makeRuleExistsQueryKey(
  query: string,
  projects: number[],
  organization: OrganizationSummary
): ApiQueryKey {
  // sort the projects to keep the query key invariant to the order of the projects
  const sortedProjects = [...projects].sort();
  return [
    `/organizations/${organization.slug}/dynamic-sampling/custom-rules/`,
    {
      query: {
        project: sortedProjects,
        query,
      },
    },
  ];
}

function hasTooFewSamples(numSamples: number | null | undefined) {
  // check if we have got the samples, but there are too few of them
  return (
    numSamples !== null &&
    numSamples !== undefined &&
    numSamples < INVESTIGATION_MAX_SAMPLES_TRIGGER
  );
}

function useGetExistingRule(
  query: string,
  projects: number[],
  organization: OrganizationSummary,
  numSamples: number | null | undefined
) {
  const enabled = hasTooFewSamples(numSamples);

  const result = useApiQuery<CustomDynamicSamplingRule | '' | null>(
    makeRuleExistsQueryKey(query, projects, organization),
    {
      staleTime: 0,
      enabled,
    }
  );

  if (result.data === '') {
    // cleanup, the endpoint returns a 204 (with no body), change it to null
    result.data = null;
  }

  return result;
}

function useCreateInvestigationRuleMutation(vars: CreateCustomRuleVariables) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {mutate} = useMutation<
    CustomDynamicSamplingRule,
    Error,
    CreateCustomRuleVariables
  >({
    mutationFn: (variables: CreateCustomRuleVariables) => {
      const {organization} = variables;
      const endpoint = `/organizations/${organization.slug}/dynamic-sampling/custom-rules/`;
      return api.requestPromise(endpoint, {
        method: 'POST',
        data: variables,
      });
    },
    onSuccess: (_data: CustomDynamicSamplingRule) => {
      addSuccessMessage(t('Successfully created investigation rule'));
      // invalidate the rule-exists query
      queryClient.invalidateQueries(
        makeRuleExistsQueryKey(vars.query, vars.projects, vars.organization)
      );
    },
    onError: (_error: Error) => {
      addErrorMessage(t('Unable to create investigation rule'));
    },
  });
  return mutate;
}

const InvestigationInProgressNotification = styled('span')`
  margin: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: ${space(0.5)};
`;

function InvestigationRuleCreationInternal(props: Props) {
  const projects = [...props.eventView.project];
  const organization = props.organization;
  const period = props.eventView.statsPeriod || null;
  const query = props.eventView.getQuery();
  const createInvestigationRule = useCreateInvestigationRuleMutation({
    query,
    projects,
    organization,
    period,
  });
  const request = useGetExistingRule(query, projects, organization, props.numSamples);

  if (!hasTooFewSamples(props.numSamples)) {
    // no results yet (we can't take a decision) or enough results,
    // we don't need investigation rule UI
    return null;
  }
  if (request.isLoading) {
    return null;
  }

  if (request.error !== null) {
    const errorResponse = t('Unable to fetch investigation rule');
    addErrorMessage(errorResponse);
    return null;
  }

  const rule = request.data;
  const haveInvestigationRuleInProgress = rule !== null;

  if (haveInvestigationRuleInProgress) {
    // investigation rule in progress, just show a message
    const existingRule = rule as CustomDynamicSamplingRule;
    const ruleStartDate = new Date(existingRule.startDate);
    const now = new Date();
    const interval = moment.duration(now.getTime() - ruleStartDate.getTime()).humanize();

    return (
      <InvestigationInProgressNotification>
        {tct('Collecting samples since [interval]  ago.', {interval})}

        <Tooltip
          isHoverable
          title={tct(
            'A user has temporarily adjusted retention priorities, increasing the odds of getting events matching your search query. [link:Learn more.]',
            // TODO find out where this link is pointing to
            {
              link: <ExternalLink href="https://docs.sentry.io" />,
            }
          )}
        >
          <IconQuestion size="xs" color="subText" />
        </Tooltip>
      </InvestigationInProgressNotification>
    );
  }

  // no investigation rule in progress, show a button to create one
  return (
    <Tooltip
      isHoverable
      title={tct(
        'We can find more events that match your search query by adjusting your retention priorities for an hour, increasing the odds of getting matching events. [link:Learn more.]',
        // TODO find out where this link is pointing to
        {
          link: <ExternalLink href="https://docs.sentry.io" />,
        }
      )}
    >
      <Button
        {...props.buttonProps}
        onClick={() => createInvestigationRule({organization, period, projects, query})}
        icon={<IconStack size="xs" />}
      >
        {t('Get Samples')}
      </Button>
    </Tooltip>
  );
}

export function InvestigationRuleCreation(props: Props) {
  return (
    <Feature features={['investigation-bias']}>
      <InvestigationRuleCreationInternal {...props} />
    </Feature>
  );
}
