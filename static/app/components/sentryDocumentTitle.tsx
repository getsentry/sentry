import {createContext, useContext, useEffect, useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

const DEFAULT_PAGE_TITLE = 'Sentry';
const DocumentTitleContext = createContext(DEFAULT_PAGE_TITLE);

export function useDocumentTitle() {
  return useContext(DocumentTitleContext);
}

interface SentryDocumentTitleProps extends DocumentTitleOptions {
  children?: React.ReactNode;
}

/**
 * Assigns the document title. The deepest nested version of this title will be
 * the one which is assigned.
 */
export default function SentryDocumentTitle({
  title,
  orgSlug,
  projectSlug,
  noSuffix,
  children,
}: SentryDocumentTitleProps) {
  const parentTitle = useContext(DocumentTitleContext);
  const documentTitle = useMemo(
    () => makeSentryDocumentTitle(title ?? '', orgSlug, projectSlug, noSuffix),
    [orgSlug, projectSlug, title, noSuffix]
  );

  // NOTE: We do this OUTSIDE of a use effect so that the update order is
  // correct, otherwsie the inner most SentryDocumentTitle will have its
  // useEffect called first followed by the parents, which will cause the wrong
  // title be set.
  if (document.title !== documentTitle) {
    document.title = documentTitle;
  }

  useEffect(() => {
    return () => {
      document.title = parentTitle;
    };
  }, [parentTitle]);

  return <DocumentTitleContext value={documentTitle}>{children}</DocumentTitleContext>;
}

export interface DocumentTitleOptions {
  title: string;
  noSuffix?: boolean;
  orgSlug?: Organization['slug'];
  projectSlug?: Project['slug'];
}

function makeSentryDocumentTitle(
  title: string,
  orgSlug?: string,
  projectSlug?: string,
  noSuffix?: boolean
) {
  const titleWithComponents = [title, orgSlug, projectSlug].filter(Boolean).join(' — ');

  if (noSuffix) {
    return titleWithComponents;
  }

  return `${titleWithComponents} — Sentry`;
}
