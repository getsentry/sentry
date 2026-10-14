import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {startFullAutofix} from 'sentry/components/issues/groupAutofixStatus';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getConventionIssuesQuery} from 'sentry/views/codeConventions/utils';

const BATCH_SIZE = 5;

/**
 * Starts full Autofix runs on the next few issues of a convention that haven't
 * had one, so fixes can be worked through in small batches.
 */
export function ConventionBatchAutofix({conventionName}: {conventionName: string}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const batch = useMutation({
    mutationFn: async () => {
      const issuesQuery = getConventionIssuesQuery(conventionName);
      const {json: issues} = await queryClient.fetchQuery(
        apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
          path: {organizationIdOrSlug: organization.slug},
          query: {
            ...issuesQuery,
            query: `${issuesQuery.query} !has:issue.seer_last_run`,
            limit: BATCH_SIZE,
            sort: 'date',
          },
          staleTime: 0,
        })
      );
      const results = await Promise.allSettled(
        issues.map(issue => startFullAutofix(organization.slug, issue.id))
      );
      return {
        started: results.filter(result => result.status === 'fulfilled').length,
        failed: results.filter(result => result.status === 'rejected').length,
      };
    },
    onSuccess: ({started, failed}) => {
      if (started === 0 && failed === 0) {
        addSuccessMessage(t('Every issue in this convention already has an Autofix run'));
        return;
      }
      if (started > 0) {
        addSuccessMessage(
          tn('Started Autofix on %s issue', 'Started Autofix on %s issues', started)
        );
      }
      if (failed > 0) {
        addErrorMessage(
          tn(
            'Autofix failed to start on %s issue',
            'Autofix failed to start on %s issues',
            failed
          )
        );
      }
    },
    onError: () => addErrorMessage(t('Unable to start Autofix')),
  });

  if (!areAiFeaturesAllowed(organization)) {
    return null;
  }

  return (
    <Button
      size="xs"
      busy={batch.isPending}
      disabled={batch.isPending}
      onClick={() => batch.mutate()}
    >
      {tn('Autofix next %s', 'Autofix next %s', BATCH_SIZE)}
    </Button>
  );
}
