import {useEffect, useRef, useState} from 'react';
import {useDebouncer} from '@tanstack/react-pacer';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  getInvestigationDetailQueryOptions,
  investigationListQueryOptions,
  investigationTitleGenerationQueryOptions,
  useRenameInvestigationMutation,
} from 'sentry/views/investigations/api';
import {updateInvestigationCache} from 'sentry/views/investigations/investigationCache';
import type {InvestigationDetail} from 'sentry/views/investigations/types';

import {isTitleGenerationActive} from './utils';

const DEFAULT_INVESTIGATION_TITLE = 'Untitled investigation';

export type InvestigationTitle = ReturnType<typeof useInvestigationTitle>;

/**
 * The investigation's editable title, with the title Seer is still generating
 * standing in for the default one. Whoever shows the title outside the
 * notebook calls this and hands it to `InvestigationPageContent`, so both show
 * the same draft.
 */
export function useInvestigationTitle(investigation: InvestigationDetail) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const persistedTitle = useRef(investigation.title);
  const titleGenerationSettledFor = useRef<string | null>(null);
  const detailOptions = getInvestigationDetailQueryOptions(
    organization.slug,
    investigation.id
  );
  const titleGenerationQuery = useQuery({
    ...investigationTitleGenerationQueryOptions(organization.slug, investigation.id),
    enabled: isTitleGenerationActive(investigation.titleGeneration?.status),
    refetchInterval: query =>
      isTitleGenerationActive(query.state.data?.json.status) ? 500 : false,
  });
  const generatedTitlePreview =
    draftTitle === null &&
    investigation.title === DEFAULT_INVESTIGATION_TITLE &&
    isTitleGenerationActive(titleGenerationQuery.data?.status)
      ? titleGenerationQuery.data?.preview
      : null;
  const displayedTitle = draftTitle ?? generatedTitlePreview ?? investigation.title;

  useEffect(() => {
    const status = titleGenerationQuery.data?.status;
    if (isTitleGenerationActive(status)) {
      if (titleGenerationSettledFor.current === investigation.id) {
        titleGenerationSettledFor.current = null;
      }
      return;
    }
    if (
      (status === 'completed' || status === 'failed') &&
      titleGenerationSettledFor.current !== investigation.id
    ) {
      titleGenerationSettledFor.current = investigation.id;
      void queryClient.invalidateQueries({queryKey: detailOptions.queryKey});
      void queryClient.invalidateQueries({
        queryKey: investigationListQueryOptions({
          organizationSlug: organization.slug,
        }).queryKey,
      });
    }
  }, [
    detailOptions.queryKey,
    investigation.id,
    organization.slug,
    queryClient,
    titleGenerationQuery.data?.status,
  ]);

  const renameMutation = useRenameInvestigationMutation(
    organization.slug,
    investigation.id,
    {
      onSuccess: updated => {
        persistedTitle.current = updated.title;
      },
      onError: () => toast.error(t('Unable to rename investigation.')),
    }
  );
  const renameDebouncer = useDebouncer(
    (nextTitle: string) => {
      const title = nextTitle.trim();
      if (title && title !== persistedTitle.current) {
        renameMutation.mutate(title);
      }
    },
    {wait: 500, onUnmount: debouncer => debouncer.flush()}
  );

  useEffect(() => {
    if (draftTitle === null) {
      persistedTitle.current = investigation.title;
    }
  }, [draftTitle, investigation.title]);

  function handleChange(nextTitle: string) {
    setDraftTitle(nextTitle);
    updateInvestigationCache(
      queryClient,
      organization.slug,
      investigation.id,
      current => ({...current, title: nextTitle})
    );
    renameDebouncer.maybeExecute(nextTitle);
  }

  function handleBlur() {
    renameDebouncer.cancel();
    if (draftTitle === null) {
      return;
    }
    const title = draftTitle.trim();
    if (title) {
      if (title !== draftTitle) {
        setDraftTitle(title);
        updateInvestigationCache(
          queryClient,
          organization.slug,
          investigation.id,
          current => ({...current, title})
        );
      }
      if (title !== persistedTitle.current) {
        renameMutation.mutate(title);
      }
      return;
    }
    setDraftTitle(null);
    updateInvestigationCache(
      queryClient,
      organization.slug,
      investigation.id,
      current => ({...current, title: persistedTitle.current})
    );
  }

  return {
    displayedTitle,
    isSaving: renameMutation.isPending,
    onChange: handleChange,
    onBlur: handleBlur,
    /** Drops a rename that hasn't been sent yet, like before a delete. */
    cancelPendingRename: () => renameDebouncer.cancel(),
  };
}
